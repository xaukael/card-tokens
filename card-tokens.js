// Contact me if you use cards, have interest in taking over this module, and  have the skills to do so

var createCardToken = async function(data, userId) {
  let card = fromUuidSync(data.uuid);
  let scene = Scene.get(data.sceneId)
  if(!scene) scene = canvas.scene
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  let drawing = scene.drawings.find(d=>d.text==card.parent.name);
  if (drawing) data = {...data, ...drawing.object.center}
  if (actor) {
    let token = {...actor.prototypeToken,...data, ...{actorId: actor.id}}
    token.x -= token.width * scene.dimensions.size * .5
    token.y -= token.height * scene.dimensions.size * .5
    while (scene.tokens.find(t=>t.x == Math.round(token.x) && t.y == Math.round(token.y))) {
      token.x += scene.dimensions.size/4
      token.y += scene.dimensions.size/4
    }
    data.rotation += actor.prototypeToken.texture.rotation
    return  scene.createEmbeddedDocuments('Token', [token])
  }
  Hooks.once('createActor', async (actor)=>{ 
    let token = {...actor.prototypeToken,...data, ...{actorId: actor.id}}
    token.x -= token.width * scene.dimensions.size * .5
    token.y -= token.height * scene.dimensions.size * .5
    while (scene.tokens.find(t=>t.x == Math.round(token.x) && t.y == Math.round(token.y))) {
      token.x += scene.dimensions.size/4
      token.y += scene.dimensions.size/4
    }
    scene.createEmbeddedDocuments('Token', [token])
  })
}

var flipCardToken = async function (uuid, src) {
  let card = fromUuidSync(uuid)
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) return;
  let token = canvas.scene.tokens.find(i=>i.actor?.id==actor.id).object
  if (!token) return;
  if(!PIXI.Cache.has(src)) await loadTexture(src);
  const scale = token.mesh.scale[game.settings.get('card-tokens', 'flipDirection')];
  await CanvasAnimation.animate([{
    parent: token.mesh.scale,
    attribute: game.settings.get('card-tokens', 'flipDirection'),
    to: 0,
  }], {duration:250});
  token.mesh.texture = PIXI.Cache.get(src);
  await CanvasAnimation.animate([{
    parent: token.mesh.scale,
    attribute: game.settings.get('card-tokens', 'flipDirection'),
    to: scale,
  }], {duration:250});
  return true
}

Hooks.on('canvasReady', (canvas)=>{
  canvas._onMouseWheel = function(event) {
    if ( event.altKey) {
      let degrees = 5;
      if (event.ctrlKey) degrees = 15;
      if (event.shiftKey) degrees = 45;
      canvas.stage.rotation = (event.delta < 0 ? (canvas.stage.rotation + Math.toRadians(degrees)) : (canvas.stage.rotation - Math.toRadians(degrees))) % (2*Math.PI);
      canvas.hud.align();
      Hooks.call('canvasPan', canvas, {});
      return;
    }
    
    let dz = ( event.delta < 0 ) ? 1.05 : 0.95;
    this.pan({scale: dz * canvas.stage.scale.x});
    return // the rest of this tries to take over zooming at the cursor which can be weird
    const scale = dz * canvas.stage.scale.x
    const d = canvas.dimensions
    const max = CONFIG.Canvas.maxZoom
    const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max)
  
    if (scale > max || scale < min) {
      canvas.pan({ scale: scale > max ? max : min })
      console.log('Zoom/Pan Options |', `scale limit reached (${scale}).`)
      return
    }
  
    // Acquire the cursor position transformed to Canvas coordinates
    const t = canvas.stage.worldTransform
    const dx = ((-t.tx + event.clientX) / canvas.stage.scale.x - canvas.stage.pivot.x) * (dz - 1)
    const dy = ((-t.ty + event.clientY) / canvas.stage.scale.y - canvas.stage.pivot.y) * (dz - 1)
    const x = canvas.stage.pivot.x + dx
    const y = canvas.stage.pivot.y + dy
    canvas.pan({ x, y, scale })
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
  if (!token.actor?.flags.world?.card) return;
  let scenes = game.scenes.filter(m=>m.tokens.filter(i=>token.actor.flags.world.card===i.actor?.flags.world?.card).length);
  if (!scenes.length) {
    let card = fromUuidSync(token.actor.flags.world?.card);
    let src = card.face!=null?card.faces[card.face].img:card.back.img;
    token.updateSource({texture:{src}});
    return true;
  }
  ui.notifications.warn(`Card already on scene: ${scenes.map(s=>s.name).join()}`);
  return false;
});

Hooks.on('preUpdateToken',  (token, update, options) =>{
  if (!game.settings.get('card-tokens', 'noCardMoveAnimation')) return;
  if (!token.actor.flags.world?.card) return;
  options.animate = false;
});

Hooks.once("socketlib.ready", () => {
  window.socketForCardTokens = socketlib.registerModule("card-tokens");
  window.socketForCardTokens.register("createCardToken", createCardToken);
  window.socketForCardTokens.register("flipCardToken", flipCardToken);
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
  if (game.release.generation>=12) {
    x = data.x
    y = data.y
  } else {
    data.x = x
    data.y = y
  }
  data.rotation = Math.toDegrees(canvas.stage.rotation)*-1;
  data.sceneId = canvas.scene.id
  if (data.type != "Card") return;
  if (!game.users?.find((u) => u.isGM && u.active)) return ui.notifications.error('Card tokens does not function without a GM logged in to create actors and tokens.');
  let card = fromUuidSync(data.uuid);
  Hooks.once('renderDialog', (app, html, dialogOptions)=>{
    html.find('.dialog-buttons').append($(`<button class="do-not-pass"><i class="fa-solid fa-caret-down"></i> Do Not Pass</button>`).click( async function(){
      let face = html.find('input[name="down"]').is(':checked')?null:card.face;
      await card.update({face});
      window.socketForCardTokens.executeAsGM("createCardToken", data, game.user.id);
      app.close();
    }));  
  });
  
  let newCards = await card.parent.playDialog(card);
  if (!newCards?.length) return ;
  data.uuid = newCards[0].uuid;
  let drawing = canvas.scene.drawings.find(d=>d.text==newCards[0].parent.name)
  if (!drawing) return window.socketForCardTokens.executeAsGM("createCardToken", data, game.user.id)
});

Hooks.on('renderTokenHUD', (app, html, hudData)=>{
  let actor = app.object.document.actor;
  if (!actor) return;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  if (!card) return;
  /*
  if (card.back.img!=app.object.document.texture.src)
  html.find('.bar2').after($(`<div class="control-icon face" style="margin:auto ; width:${app.object.w/2}px; flex: 0 0 ${app.object.w/2}px;  justify-content: center;" title="back">
  <img style="padding:0.5em; height: 100%;" src="${card.back.img}"> </div>`)
  .click(function(){ 
    
      app.object.layer.hud.clear()
    card.update({face:null}) 
  }));
  for (let face of card.faces) {
    if (face.img!=app.object.document.texture.src)//flex: 0 0 ${app.object.w}px;
    html.find('.bar2').after($(`<div class="control-icon face" data-face="${card.faces.indexOf(face)}" style="margin:auto; width:${app.object.w/2}px; flex: 0 0 ${app.object.w/2}px;  justify-content: center;" title="${face.name}">
    <img style="padding:0.5em; height: 100%; justify-content: center;" src="${face.img}"></div>`)
    .click(function(){
      app.object.layer.hud.clear()
      card.update({face:Number($(this).data().face)
                  })}))
  }
  */
  html.find('.col.left > div.elevation, .col.left > div[data-action="config"], .col.right > div, .col.middle > .attribute').remove()
  html.find('.col.right')
    .append($(`<div class="control-icon" data-action="next-face" data-tooltip="Next Face"><i class="fa-solid fa-caret-up"></i></div>`)
      .click(function(){ card.update({face: card.face === null ? 0 : card.face+1}); }))
  html.find('.col.right')
    .append($(`<div class="control-icon" data-action="previous-face" data-tooltip="Previous Face"><i class="fa-solid fa-caret-down"></i></div>`)
      .click(function(){ card.update({face: card.face === 0 ? null : card.face-1}); }))
});

Hooks.on('deleteActor', async (actor)=>{
  if (!game.users?.find((u) => u.isGM && u.active).isSelf) return;
  if (!actor.flags.world?.card) return;
  game.scenes.map(s=>{return s.deleteEmbeddedDocuments("Token", s.tokens.filter(i=>i.actorId==actor.id).map(t=>t.id))})
});

Hooks.on('preCreateActor', async (actor)=>{
  if (game.system.id != "dnd5e") return;
  if (!actor.flags.world?.card) return;
  let card = await fromUuid(actor.flags.world?.card)
  actor.updateSource({prototypeToken: {
      height: card.height || game.settings.get("card-tokens", "height"), 
      width: card.width || game.settings.get("card-tokens", "width")
  }})
});

Hooks.on('createCard', async (card, options, user)=>{
  if (!game.users?.find((u) => u.isGM && u.active).isSelf) return;
  if (card.parent.type=="deck") return;
  let folder = game.folders.get(card.parent.id)//find(f=>f.name==card.parent.name&&f.type=="Actor");
  if (!folder) createFolderDebounce({_id: card.parent.id, type:'Actor', name: card.parent.name, flags:{world:{cards:card.parent.uuid}}})
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  let model = game.release.generation < 12 ? game.system.model : game.model
  let type = Object.keys(model['Actor']).filter(t=>t!="base")[0]
  if (!actor) actor = await Actor.create({
    img: card.faces[card.face]?.img || card.faces[0]?.img, 
    name: card.uuid, 
    type, 
    ownership: card.parent.ownership,
    folder: folder?.id || null,
    prototypeToken: {
      name:card.name,
      texture: {src:card.face!=null?card.faces[card.face].img:card.faces[0].img}, 
      actorLink: true,
      height: card.height || game.settings.get("card-tokens", "height"), 
      width: card.width || game.settings.get("card-tokens", "width"),
      texture:{rotation: card.rotation},
      displayName: game.settings.get("card-tokens", "displayName"),
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
      bar1: {attribute: null},
      bar2: {attribute: null}
    },
    flags:{world:{card:card.uuid}}
  })
  let drawing = canvas.scene.drawings.find(d=>d.text==card.parent.name)
  if (!drawing) return;
  let data = {...drawing.object.center, uuid: card.uuid, rotation: (Math.toDegrees(canvas.stage.rotation)*-1)+card.rotation}
  window.socketForCardTokens.executeAsGM("createCardToken", data, game.user.id);
})

Hooks.on('updateCard', async (card, update, options, user)=>{
  if (!game.users?.find((u) => u.isGM && u.active).isSelf) return;
  if (!update.hasOwnProperty('face')) return;
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) return;
  let src = card.faces[update.face]?.img || card.back.img;
  window.socketForCardTokens.executeForEveryone("flipCardToken", card.uuid, src);
  await new Promise(r=>setTimeout(r,500));
  await Promise.all(game.scenes.map(s=> { return  s.updateEmbeddedDocuments("Token", s.tokens?.filter(i=>i.actor?.id==actor.id).map(t=>{return {_id:t._id, texture:{src}, name: card.name}}), {animate: false} )}))
  
})

Hooks.on('deleteCard', async (card, options, user)=>{
  if (!game.users?.find((u) => u.isGM && u.active).isSelf) return;
  await Actor.deleteDocuments(game.actors.filter(a=>a.flags.world?.card==card.uuid).map(c=>c._id))
  
  let folder = game.folders.find(f=>f.name==card.parent.name&&f.type=="Actor");
  let actors = game.actors.filter(a=>a.folder?.id==folder?.id);
  if (actors.length) return;
  await Folder.deleteDocuments([folder.id]);
})

var createFolderDebounce = foundry.utils.debounce((data)=> { Folder.create(data, {keepId:true}) }, 500);

Hooks.on('createFolder', (folder)=>{
  if (!game.users?.find((u) => u.isGM && u.active).isSelf) return;
  if (folder.type!="Actor") return;
  if (!folder.flags.world?.cards) return;
  Actor.updateDocuments(game.actors.filter(a=>a.flags.world?.card?.includes(folder.flags.world?.cards) && !a.folder).map(a=>{return {_id:a.id, folder:folder.id} }))
})

Hooks.on('renderSidebarTab', (app, html, options)=>{
  if(app.entryType!="Actor") return;
  [...game.cards.keys()].forEach((id)=>{
    html.find(`[data-folder-id=${id}]`).remove()
  })
})

Hooks.on('renderActorSheet', (app, html, data)=>{
  let actor = app.object;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  
  html.ready(function(){app.close()});
  html.closest('.app').remove()//.css({display:'none'});
  card.parent.playDialog(card);
  return false;
})

Hooks.once("init", async () => {
  game.settings.register('card-tokens', 'width', {
    name: `Default Width`,
    hint: `Width for cards that do not have one set`,
    scope: "world",
    config: true,
    type: Number,
    default: 2,
    onChange: value => { }
  });
  game.settings.register('card-tokens', 'height', {
    name: `Default Height`,
    hint: `Height for cards that do not have one set`,
    scope: "world",
    config: true,
    type: Number,
    default: 3,
    onChange: value => { }
  });
  game.settings.register('card-tokens', 'flipDirection', {
    name: `Flip Animation Direction`,
    hint: `Flip horizontally (x) or vetically (y)`,
    scope: "world",
    type: String,
    choices: {
      "x": "horizontally",
      "y": "vertically"
    },
    default: "y",
    config: true,
    onChange: async value => {  }
  });
  
  game.settings.register('card-tokens', 'displayName', {
    name: `Token Name Display`,
    hint: `Owner Hover Suggested`,
    scope: "world",
    type: Number,
    choices: {
  0: "NONE",
  10:"CONTROL",
  20:"OWNER_HOVER",
  30:"HOVER",
  40:"OWNER",
  50:"ALWAYS"
},
    default: 20,
    config: true,
    onChange: async value => { 
      let updates = game.actors.filter(a=>a.flags.world?.card).map(actor => ({ _id : actor.id, "prototypeToken.displayName" : value}));
      await Actor.updateDocuments(updates);
      for (let scene of game.scenes)
        await scene.updateEmbeddedDocuments("Token", scene.tokens.filter(t=>t.actor?.flags.world?.card).map(t=>{return {_id:t.id, displayName: value }}))
    }
  });
  
  game.settings.register('card-tokens', 'noCardMoveAnimation', {
    name: `No Card Move Animation`,
    hint: `prevent cards from animating when moving`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => { }
  });
});