
var createCardToken = async function(data, userId) {
  let card = fromUuidSync(data.uuid);
  let src = data.src;
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (actor) {
    //let scene = game.scenes.get(data.scene)
    //if (canvas.scene.id!=data.scene) return ui.notifications.warn('A player is trying to spawn a card on another scene');
    //if (scene.tokens.find(t=>t.actor.flags.world?.card==data.uuid)) return ui.notifications.warn('Card already on canvas');
    warpgate.spawnAt(data, await actor.getTokenDocument(), {token:{texture:{src}}})
    return; 
  }
  Hooks.once('createActor', async (actor)=>{
    //let scene = game.scenes.get(data.scene)
    //if (scene.tokens.find(t=>t.actor?.flags?.world?.card==data.uuid)) return ui.notifications.warn('Card already on canvas');
    warpgate.spawnAt(data, await actor.getTokenDocument(), {token:{texture:{src}}})
  })
}

Hooks.on('preCreateToken', (token)=>{
  if (!token.actor.flags.world?.card) return;
  let scenes = game.scenes.filter(m=>m.tokens.filter(i=>i.actor?.id==token.actor.id).length);
  if (!scenes.length) {
    let card = fromUuidSync(token.actor.flags.world?.card)
    let src = card.face?card.faces[card.face].img:card.back.img;
    token.data.update({texture:{src}});
    return true;
  }
  ui.notifications.warn(`Card already on scenes: ${scenes.map(s=>s.name).join()}`);
  return false;
})

Hooks.once("socketlib.ready", () => {
	window.socket = socketlib.registerModule("card-tokens");
	window.socket.register("createCardToken", createCardToken);
});

Hooks.on('dropCanvasData', async (canvas, data)=>{
  if (data.type != "Card") return;
  let card = fromUuidSync(data.uuid);
  data.shiftKey = event.shiftKey;
  data.scene = canvas.scene.id;
  let $span = game.cards.filter(c=>c.type=="pile").reduce((span, pile)=>{
    span.append(`<h1 style="color:white">${pile.name}</h1>`)
    let div = $(`<div class="flexrow" style="justify-content:center; "></div>`)
    div.append($(`<span class="control-icon" data-id="${pile.id}" data-face="back" style="margin:.2em; width:${canvas.grid.size}px; flex: 0 0 ${canvas.grid.size*.75}px;" title="Face Down"><center>
    <img style="padding:0.1em; width:${card.width*canvas.grid.size/4}px; height:${card.height*canvas.grid.size/4}px;" src="${card.back.img}"></center></span>`))
    for (let face of card.faces) 
    div.append($(`<span class="control-icon" data-id="${pile.id}" data-face="${card.faces.indexOf(face)}" style="margin:.2em; width:${canvas.grid.size}px; flex: 0 0 ${canvas.grid.size*.75}px;" title="${face.name}"><center>
      <img style="padding:0.1em; width:${card.width*canvas.grid.size/4}px; height:${card.height*canvas.grid.size/4}px;" src="${face.img}"></center></span>`))
    span.append(div)
    return span;
  }, $(`<span class="placeable-hud" style="position:absolute; transform: translate(-50%, -50%); left:${data.x}px; top: ${data.y}px; pointer-events: all; width:max-content; border: 1px solid var(--color-border-dark);border-radius: 5px; background-image: url(../ui/denim075.png); padding: 8px;"></span>`))
  $span.find('.control-icon').click(async function(){
    let face = $(this).data().face=="back"?null:Number($(this).data().face);
    data.src = $(this).find('img').attr('src');
    if (card.parent.id==$(this).data().id) {
      await card.update({face});
      $(this).closest('.placeable-hud').remove();
      return window.socket.executeAsGM("createCardToken", data, game.user.id);
    }
    data.pile = $(this).data().id;
    let pile = game.cards.get(data.pile);
    let newCards = await card.parent.pass(pile, [card.id],{updateData: {face}});
    data.uuid = newCards[0].uuid;
    $(this).closest('.placeable-hud').remove();
    window.socket.executeAsGM("createCardToken", data, game.user.id);
  })
  $span.contextmenu(function(){$(this).closest('.placeable-hud').remove();})
  $('#hud').append($span)
  
});

Hooks.on('renderTokenHUD', (app, html, hudData)=>{
  let actor = app.object.document.actor;
  if (!actor) return;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  if (!card) return;
  html.find('.control-icon').remove();
  html.find('.attribute.bar1').addClass('flexrow').css({'justify-content': 'center', 'top': '1em'})
  if (card.back.img!=app.object.document.texture.src)
  html.find('.attribute.bar1').append($(`<div class="control-icon" style="margin:.2em; width:${app.object.w*2}px; flex: 0 0 ${app.object.w/2}px;" title="back"><center>
  <img style="padding:0.1em; width:${card.width*canvas.grid.size/4}px; height:${card.height*canvas.grid.size/4}px;" src="${card.back.img}"></center></div>`)
  .click(function(){ card.update({face:null}) }))
  for (let face of card.faces) {
    if (face.img!=app.object.document.texture.src)
    html.find('.attribute.bar1').append($(`<div class="control-icon" data-face="${card.faces.indexOf(face)}" style="margin:.2em; width:${app.object.w*2}px; flex: 0 0 ${app.object.w/2}px;" title="${face.name}"><center>
    <img style="padding:0.1em; width:${card.width*canvas.grid.size/4}px; height:${card.height*canvas.grid.size/4}px;" src="${face.img}"></center></div>`)
    .click(function(){ card.update({face:Number($(this).data().face)}) }))
  }
  /*
  let $pass = $(`<div class="control-icon pass" title="pass"><i class="fas fa-share-square"></i></div>`).click(async function(){   
    let buttons = game.cards.filter(c=>c.permission>1&&c.type!=='deck'&&card.parent.id!=c.id)
    .reduce((buttons, c)=>{ buttons[c.name.slugify()] = {label: c.name, callback: ()=> { return c; }}; return buttons},{})
    let stack = await Dialog.wait({title: 'Choose a Stack', buttons, render:(html)=>{$(html[2]).css({'flex-direction':'column'})}},{width:100});
    let newCards = await card.parent.pass(stack, [card.id],{updateData: {face:null}});
  });
  html.find('.col.right').append($pass);*/
});

Hooks.on('deleteActor', async (actor)=>{
  if (!game.user.isGM) return;
  if (!actor.flags.world?.card) return;
  //for (let scene of game.scenes) scene.deleteEmbeddedDocuments("Token", scene.tokens.filter(i=>i.actor?.id==actor.id).map(t=>t._id))
  await Promise.all(game.scenes.map(s=>{return s.deleteEmbeddedDocuments("Token", s.tokens.filter(i=>i.actor?.id==actor.id).map(t=>t._id))}))
})

Hooks.on('createCard', async (card, options, user)=>{
  if (!game.user.isGM) return;
  if (card.parent.type=="deck") return;
  let folder = game.folders.find(f=>f.name==card.parent.name&&f.type=="Actor");
  if (!folder) createFolderDebounce({type:'Actor', name: card.parent.name, flags:{world:{cards:card.parent.uuid}}})
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) actor = Actor.create({
    img: card.faces[card.face]?.img || card.faces[0]?.img, 
    name: card.name, 
    type: Object.keys(game.system.model.Actor)[0], 
    ownership: card.parent.ownership,
    folder: folder?.id || null,
    token: {
      texture: {src:card.face!=null?card.faces[card.face].img:card.faces[0].img}, 
      height: card.height, 
      width: card.width,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
      bar1: {attribute: null},
      bar2: {attribute: null}
    },
    flags:{world:{card:card.uuid}}
  })
})

Hooks.on('updateCard', async (card, update, options, user)=>{
  if (!game.user.isGM) return;
  if (!update.hasOwnProperty('face')) return;
  let actor = game.actors.find(a=>a.flags.world?.card==card.uuid);
  if (!actor) return;
  //let tokens = actor.getActiveTokens();
  let src = card.faces[update.face]?.img || card.back.img;
  await Promise.all(game.scenes.map(s=> { return  s.updateEmbeddedDocuments("Token", s.tokens.filter(i=>i.actor?.id==actor.id).map(t=>{return {_id:t._id, texture:{src}}}))}))
  //await Promise.all(tokens.map(async t=> { return await t.scene.updateEmbeddedDocuments("Token", [{_id: t.document.id, texture:{src}}])}))
})

Hooks.on('deleteCard', async (card, options, user)=>{
  if (!game.user.isGM) return;
  await Actor.deleteDocuments(game.actors.filter(a=>a.flags.world?.card==card.uuid).map(c=>c._id))
  let folder = game.folders.find(f=>f.name==card.parent.name&&f.type=="Actor");
  let actors = game.actors.filter(a=>a.folder?.id==folder?.id);
  if (actors.length) return;
  await Folder.deleteDocuments([folder.id]);
})

var createFolderDebounce = foundry.utils.debounce((data)=> { Folder.create(data) }, 500);

Hooks.on('createFolder', (folder)=>{
  if (folder.type!="Actor") return;
  if (!folder.flags.world?.cards) return;
  Actor.updateDocuments(game.actors.filter(a=>a.flags.world?.card?.includes(folder.flags.world?.cards) && !a.folder).map(a=>{return {_id:a.id, folder:folder.id} }))
})

Hooks.on('renderActorSheet', (app, html)=>{
  let actor = app.object;
  if (!actor.flags.world?.card) return;
  let card = fromUuidSync(actor.flags.world?.card);
  card.parent.playDialog(card);
  html.css({display:'none'})
  html.ready(function(){app.close()})
})