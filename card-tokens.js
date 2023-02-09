
var createCardToken = async function(data, userId) {
  let card = fromUuidSync(data.uuid);
  let src = data.src;
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (actor) return warpgate.spawnAt(data, await actor.getTokenDocument(), {token:{texture:{src}, rotation:data.rotation}});
  let drawing = canvas.scene.drawings.find(d=>d.text==card.parent.name)
  if (drawing) data = {...data, ...drawing.object.center}
  Hooks.once('createActor', async (actor)=>{ 
    warpgate.spawnAt(data, await actor.getTokenDocument(), {token:{texture:{src}, rotation:data.rotation}}, {}, {collision:!!drawing}) 
  })
}

Hooks.on('canvasReady', (canvas)=>{
  canvas._onMouseWheel = function(event) {
    if ( event.altKey) {
      let degrees = 5;
      if (event.ctrlKey) degrees = 15;
      if (event.shiftKey) degrees = 45;
      canvas.stage.rotation = event.delta < 0 ? canvas.stage.rotation + Math.toRadians(degrees) : canvas.stage.rotation - Math.toRadians(degrees);
      canvas.hud.align();
      Hooks.call('canvasPan', canvas, {});
      return;
    }
    let dz = ( event.delta < 0 ) ? 1.05 : 0.95;
    this.pan({scale: dz * canvas.stage.scale.x});
  }

  canvas.hud.align = function() {
    const hud = this.element[0];
    const {x, y} = canvas.primary.getGlobalPosition();
    const scale = canvas.stage.scale.x;
    hud.style.left = `${x}px`;
    hud.style.top = `${y}px`;
    hud.style.transform = `scale(${scale}) rotate(${Math.round(Math.toDegrees(canvas.stage.rotation)/5)*5}deg)`;
  }
});

Hooks.on('preCreateToken', (token)=>{
  if (!token.actor.flags.world?.card) return;
  let scenes = game.scenes.filter(m=>m.tokens.filter(i=>i.actor?.id==token.actor.id).length);
  if (!scenes.length) {
    let card = fromUuidSync(token.actor.flags.world?.card);
    let src = card.face!=null?card.faces[card.face].img:card.back.img;
    token.data.update({texture:{src}});
    return true;
  }
  ui.notifications.warn(`Card already on scenes: ${scenes.map(s=>s.name).join()}`);
  return false;
});

Hooks.once("socketlib.ready", () => {
	window.socket = socketlib.registerModule("card-tokens");
	window.socket.register("createCardToken", createCardToken);
});

Hooks.on('dropCanvasData', async (canvas, data)=>{
  var rotate = function(cx, cy, x, y, radians) {
    var cos = Math.cos(radians),
        sin = Math.sin(radians),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return {x:nx, y:ny};
  }
  let {x, y} = rotate(0, 0, data.x, data.y, canvas.stage.rotation);
  data.x = x;
  data.y = y;
  data.rotation = Math.toDegrees(canvas.stage.rotation)*-1;
  if (data.type != "Card") return;
  let card = fromUuidSync(data.uuid);
  //data.scene = canvas.scene.id;
  console.log(data)
  Hooks.once('renderDialog', (app, html, dialogOptions)=>{
    html.find('.dialog-buttons').append($(`<button class="do-not-pass"><i class="fa-solid fa-caret-down"></i> Do Not Pass</button>`).click( async function(){
      let face = html.find('input[name="down"]').is(':checked')?null:card.face;
      await card.update({face});
      window.socket.executeAsGM("createCardToken", data, game.user.id);
      app.close();
    }));
  });
  
  let newCards = await card.parent.playDialog(card);
  if (!newCards?.length) return;
  data.uuid = newCards[0].uuid;
  return window.socket.executeAsGM("createCardToken", data, game.user.id);
});

Hooks.on('renderTokenHUD', (app, html, hudData)=>{
  let actor = app.object.document.actor;
  if (!actor) return;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  if (!card) return;
  if (card.back.img!=app.object.document.texture.src)
  html.find('.bar2').after($(`<div class="control-icon face" style="margin:.2em; width:${app.object.w}px; flex: 0 0 ${app.object.w}px;  justify-content: center;" title="back">
  <img style="padding:0.5em; height: 100%;" src="${card.back.img}"> </div>`)
  .click(function(){ card.update({face:null}) }));
  for (let face of card.faces) {
    if (face.img!=app.object.document.texture.src)//flex: 0 0 ${app.object.w}px;
    html.find('.bar2').after($(`<div class="control-icon face" data-face="${card.faces.indexOf(face)}" style="margin:.2em; width:${app.object.w}px; flex: 0 0 ${app.object.w}px;  justify-content: center;" title="${face.name}">
    <img style="padding:0.5em; height: 100%; justify-content: center;" src="${face.img}"></div>`)
    .click(function(){ card.update({face:Number($(this).data().face)}) }))
  }
});

Hooks.on('deleteActor', async (actor)=>{
  if (!warpgate.util.isFirstGM()) return;
  if (!actor.flags.world?.card) return;
  await Promise.all(game.scenes.map(s=>{return s.deleteEmbeddedDocuments("Token", s.tokens.filter(i=>i.actor?.id==actor.id).map(t=>t._id))}))
});

Hooks.on('createCard', async (card, options, user)=>{
  if (!warpgate.util.isFirstGM()) return;
  if (card.parent.type=="deck") return;
  let folder = game.folders.find(f=>f.name==card.parent.name&&f.type=="Actor");
  if (!folder) createFolderDebounce({type:'Actor', name: card.parent.name, flags:{world:{cards:card.parent.uuid}}})
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) actor = await Actor.create({
    img: card.faces[card.face]?.img || card.faces[0]?.img, 
    name: card.name, 
    type: Object.keys(game.system.model.Actor)[0], 
    ownership: card.parent.ownership,
    folder: folder?.id || null,
    token: {
      texture: {src:card.face!=null?card.faces[card.face].img:card.faces[0].img}, 
      height: card.height, 
      width: card.width,
      rotation: canvas.stage.rotation,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
      bar1: {attribute: null},
      bar2: {attribute: null}
    },
    flags:{world:{card:card.uuid}}
  })
  let drawing = canvas.scene.drawings.find(d=>d.text==card.parent.name)
  if (!drawing) return;
  let data = {...drawing.object.center, uuid: card.uuid, rotation: Math.toDegrees(canvas.stage.rotation)*-1}
  window.socket.executeAsGM("createCardToken", data, game.user.id);
})

Hooks.on('updateCard', async (card, update, options, user)=>{
  if (!warpgate.util.isFirstGM()) return;
  if (!update.hasOwnProperty('face')) return;
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) return;
  let src = card.faces[update.face]?.img || card.back.img;
  await Promise.all(game.scenes.map(s=> { return  s.updateEmbeddedDocuments("Token", s.tokens.filter(i=>i.actor?.id==actor.id).map(t=>{return {_id:t._id, texture:{src}}}))}))
})

Hooks.on('deleteCard', async (card, options, user)=>{
  if (!warpgate.util.isFirstGM()) return;
  await Actor.deleteDocuments(game.actors.filter(a=>a.flags.world?.card==card.uuid).map(c=>c._id))
  let folder = game.folders.find(f=>f.name==card.parent.name&&f.type=="Actor");
  let actors = game.actors.filter(a=>a.folder?.id==folder?.id);
  if (actors.length) return;
  await Folder.deleteDocuments([folder.id]);
})

var createFolderDebounce = foundry.utils.debounce((data)=> { Folder.create(data) }, 500);

Hooks.on('createFolder', (folder)=>{
  if (!warpgate.util.isFirstGM()) return;
  if (folder.type!="Actor") return;
  if (!folder.flags.world?.cards) return;
  Actor.updateDocuments(game.actors.filter(a=>a.flags.world?.card?.includes(folder.flags.world?.cards) && !a.folder).map(a=>{return {_id:a.id, folder:folder.id} }))
})

Hooks.on('renderActorSheet', (app, html)=>{
  let actor = app.object;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  card.parent.playDialog(card);
  html.css({display:'none'});
  html.ready(function(){app.close()});
})