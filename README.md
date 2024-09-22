# Card Tokens
Drag cards to the canvas from hands or piles. On dropping the card on the canvas, you will be asked where and how to play the card withe the standard dialog.
When the card moves to that pile/hand a few things will happen:
1. an actor folder for the hand or pile will be created if one does not exist already
2. an actor representing that card will be created in that folder
3. a token will be added to the canvas with the face showing based on how the card was played

The card actor will have the same permissions of the hand/pile the card is in so owners will be able to move the token and flip the card using the token HUD.
If there is a drawing with text matching the name of the hand/pile, the cards will appear at that drawing when played whether they are dragged to the canvas or not and regardless of where they were dropped.
The token will have dimensions based on the dimensions set for the card. Keep this in mind when creating your cards. 

The addition of the face image on the token HUD is the only UI addition in this module. This module was created with the intent of making cards behave on the canvas as much as I expected they should.

Because card games are often played from different perpectives, this module also adds the ability to rotate the canvas. Holding the Alt key while scrolling will rotate the canvas Ctrl and Shift change the degree to which the canvas is rotated from 5 toto 15 and 45 degrees respectively(these modifiers will not work if you have a token selected because the token would rotate instead).

_depends on the warpgate module to spawn the cards and a GM must be logged in_

0.5.1
  - fixed cards going to the wrong drawing
    
0.5.0
  - added option for disabling animation for card tokens moving
    
0.4.7
  - fix for SWADE actor model
    
0.4.3
  - fixed double card on dragging to canvas when drawing exists.

0.4.2
  - changed socket to more unique name to avoid potential for conflicts

0.3.0

  - cards will now spawn in the center of a drawing with the text that matches the hand or pile it is played to
  - slight modification to canvas rotating. Alt = 5deg; Ctrl = 15deg; Shift = 45deg; to match token rotating
  - fixed card token spawn rotation to be vertical from the playing user's perspective

0.2.0

  - reformat hud to position card face change in center of the token
  - alt+(shift)-wheel rotates the canvas

0.1.0

  - initial package
