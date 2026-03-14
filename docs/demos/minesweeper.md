---
title: "Minesweeper"
author: "Maddest Labs"
minWidth: 20
minHeight: 14
chars: "█ *⚑₁₂₃₄₅₆₇₈"
theme: "solarlight"
fontsize: 30
---

# Minesweeper

```javascript
// Character width (2 for double-wide chars)
var charWidth = 1;

// Game state
var gridWidth = 8;
var gridHeight = 8;
var mineCount = 10;
var grid = [];  // Each cell: [revealed(0/1), isMine(0/1), flagged(0/1), adjacentMines]
var firstClick = true;
var gameOver = false;
var gameWon = false;
var cellsRevealed = 0;
var flagsPlaced = 0;
var currentDifficulty = "easy";

// Characters for display
var hiddenChar = "O";      // Hidden
var revealedChar = ".";    // Empty
var mineChar = "*";        // Mine
var flagChar = "⚑";        // Flag
var num1Char = "1";        // One
var num2Char = "2";        // Two
var num3Char = "3";        // Three
var num4Char = "4";        // Four
var num5Char = "5";        // Five
var num6Char = "6";        // Six
var num7Char = "7";        // Seven
var num8Char = "8";        // Eight

// Styles (will be initialized in on:init)
var styleHidden = undefined;
var styleRevealed = undefined;
var styleMine = undefined;
var styleFlag = undefined;
var styleNumber = undefined;

// Helper functions
function getCellIdx(x, y) {
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
    return -1;
  }
  return y * gridWidth + x;
}

function getCell(x, y) {
  const idx = getCellIdx(x, y);
  if (idx >= 0 && idx < grid.length) {
    return grid[idx];
  }
  return [0, 0, 0, 0];
}

function setCell(x, y, revealed, isMine, flagged, adjacent) {
  const idx = getCellIdx(x, y);
  if (idx >= 0 && idx < grid.length) {
    grid[idx] = [revealed, isMine, flagged, adjacent];
  }
}

function placeMines(avoidX, avoidY) {
  let minesPlaced = 0;
  let attempts = 0;
  const maxAttempts = mineCount * 100;
  
  while (minesPlaced < mineCount && attempts < maxAttempts) {
    const rx = Math.floor(Math.random() * gridWidth);
    const ry = Math.floor(Math.random() * gridHeight);
    
    let tooClose = false;
    if (rx === avoidX && ry === avoidY) {
      tooClose = true;
    }
    const dx = Math.abs(rx - avoidX);
    const dy = Math.abs(ry - avoidY);
    if (dx <= 1 && dy <= 1) {
      tooClose = true;
    }
    
    if (!tooClose) {
      const cell = getCell(rx, ry);
      if (cell[1] === 0) {
        setCell(rx, ry, 0, 1, 0, 0);
        minesPlaced++;
      }
    }
    
    attempts++;
  }
  
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = getCell(x, y);
      if (cell[1] === 0) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx !== 0 || dy !== 0) {
              const neighbor = getCell(x + dx, y + dy);
              if (neighbor[1] === 1) {
                count++;
              }
            }
          }
        }
        setCell(x, y, 0, 0, cell[2], count);
      }
    }
  }
}

function revealCell(x, y) {
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
    return false;
  }
  
  let cell = getCell(x, y);
  if (cell[0] === 1) {
    return false;
  }
  if (cell[2] === 1) {
    return false;
  }
  
  if (firstClick) {
    placeMines(x, y);
    firstClick = false;
    cell = getCell(x, y);
  }
  
  setCell(x, y, 1, cell[1], 0, cell[3]);
  cellsRevealed++;
  
  if (cell[1] === 1) {
    gameOver = true;
    return true;
  }
  
  if (cell[3] === 0) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dy !== 0) {
          revealCell(x + dx, y + dy);
        }
      }
    }
  }
  
  return true;
}

function toggleFlag(x, y) {
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
    return false;
  }
  
  const cell = getCell(x, y);
  if (cell[0] === 1) {
    return false;
  }
  
  if (cell[2] === 0) {
    setCell(x, y, 0, cell[1], 1, cell[3]);
    flagsPlaced++;
  } else {
    setCell(x, y, 0, cell[1], 0, cell[3]);
    flagsPlaced--;
  }
  
  return true;
}

function checkWin() {
  if (gameOver) {
    return false;
  }
  const totalCells = gridWidth * gridHeight;
  const targetRevealed = totalCells - mineCount;
  if (cellsRevealed >= targetRevealed) {
    gameWon = true;
    return true;
  }
  return false;
}

function setDifficulty(diff) {
  currentDifficulty = diff;
  if (diff === "easy") {
    gridWidth = 8;
    gridHeight = 8;
    mineCount = 10;
  } else if (diff === "medium") {
    gridWidth = 12;
    gridHeight = 12;
    mineCount = 20;
  } else if (diff === "hard") {
    gridWidth = 16;
    gridHeight = 16;
    mineCount = 40;
  }
  initGrid();
}

function initGrid() {
  grid = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      grid.push([0, 0, 0, 0]);
    }
  }
  firstClick = true;
  gameOver = false;
  gameWon = false;
  cellsRevealed = 0;
  flagsPlaced = 0;
}
```

```javascript on:init
// Load chars from front matter if defined
if (chars && chars.length > 0) {
  const charsList = [];
  let i = 0;
  while (i < chars.length) {
    const b = chars.charCodeAt(i);
    let charLen = 1;
    if (b < 128) {
      charLen = 1;
    } else if (b >= 192 && b < 224) {
      charLen = 2;
    } else if (b >= 224 && b < 240) {
      charLen = 3;
    } else if (b >= 240) {
      charLen = 4;
    }
    let endIdx = i + charLen;
    if (endIdx > chars.length) {
      endIdx = chars.length;
    }
    let ch = "";
    for (let j = i; j < endIdx; j++) {
      ch += chars[j];
    }
    charsList.push(ch);
    i = endIdx;
  }
  
  if (charsList.length > 0) hiddenChar = charsList[0];
  if (charsList.length > 1) revealedChar = charsList[1];
  if (charsList.length > 2) mineChar = charsList[2];
  if (charsList.length > 3) flagChar = charsList[3];
  if (charsList.length > 4) num1Char = charsList[4];
  if (charsList.length > 5) num2Char = charsList[5];
  if (charsList.length > 6) num3Char = charsList[6];
  if (charsList.length > 7) num4Char = charsList[7];
  if (charsList.length > 8) num5Char = charsList[8];
  if (charsList.length > 9) num6Char = charsList[9];
  if (charsList.length > 10) num7Char = charsList[10];
  if (charsList.length > 11) num8Char = charsList[11];
}

// Initialize styles
styleHidden = getStyle("inverted");
styleRevealed = getStyle("fg");
styleMine = getStyle("accent3");
styleFlag = getStyle("accent2");
styleNumber = getStyle("fg");

// Initialize with easy difficulty
initGrid();
```

```javascript on:input
// Handle mouse events
if (event.type === 'mouse') {
  // Use cellX/cellY for terminal cell coordinates
  const mouseX = event.cellX;
  const mouseY = event.cellY;
  
  console.log(`🎮 Minesweeper input:`, event.type, event.action, event.button, `click(${mouseX},${mouseY}) term(${termWidth}x${termHeight})`);
  
  const mouseAction = event.action;
  
  if (mouseAction === 'press') {
    // Calculate offset to match rendering
    let offsetX = Math.floor((termWidth - (gridWidth * charWidth)) / 2);
    if (charWidth === 2 && (offsetX % 2) !== 0) {
      offsetX = offsetX - 1;
    }
    const availableHeight = termHeight - 3;
    const offsetY = Math.floor((availableHeight - gridHeight) / 2) + 1;
    
    // Check if clicking on buttons at top
    const buttonY = 1;
    if (mouseY === buttonY) {
      // Easy button
      if (mouseX >= 0 && mouseX <= 5) {
        setDifficulty("easy");
        return true;
      }
      // Medium button
      else if (mouseX >= 7 && mouseX <= 14) {
        setDifficulty("medium");
        return true;
      }
      // Hard button
      else if (mouseX >= 16 && mouseX <= 22) {
        setDifficulty("hard");
        return true;
      }
      // Restart button (right-aligned)
      else if (mouseX >= termWidth - 4) {
        initGrid();
        return true;
      }
    }
    
    // Convert screen coordinates to grid coordinates
    // mouseX/mouseY are already in character coordinates from the event
    const gridX = mouseX - offsetX;
    const gridY = mouseY - offsetY;
    
    console.log(`  📍 Click: offset(${offsetX},${offsetY}) grid(${gridX},${gridY}) gridSize(${gridWidth}x${gridHeight}) state(won:${gameWon} over:${gameOver})`);
    
    // Validate grid position
    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
      console.log(`  ✓ Valid grid position: (${gridX},${gridY})`);
      if (!gameWon && !gameOver) {
        if (event.button === 'left') {  // Left click
          console.log(`  👆 Revealing cell (${gridX},${gridY})`);
          revealCell(gridX, gridY);
          checkWin();
          return true;
        } else if (event.button === 'right') {  // Right click
          console.log(`  🚩 Toggling flag (${gridX},${gridY})`);
          toggleFlag(gridX, gridY);
          return true;
        }
      } else {
        console.log(`  ⚠️ Game already finished (won:${gameWon} over:${gameOver})`);
      }
    } else {
      console.log(`  ✗ Click outside grid bounds`);
    }
  }
  
  return true;
}

else if (event.type === 'key') {
  if (event.action === 'press') {
    const key = event.key ? event.key.toLowerCase() : '';
    
    // R key - restart
    if (key === 'r') {
      initGrid();
      return true;
    }
    // ESC - quit
    else if (key === 'escape') {
      return false;
    }
  }
  
  return false;
}

return false;
```

```javascript on:render
// Clear screen
term.clear();

// Calculate rendering offset to center the grid
let offsetX = Math.floor((termWidth - (gridWidth * charWidth)) / 2);
if (charWidth === 2 && (offsetX % 2) !== 0) {
  offsetX = offsetX - 1;  // Align to even position for double-width chars
}

const availableHeight = termHeight - 3;  // Reserve lines for status
const offsetY = Math.floor((availableHeight - gridHeight) / 2) + 1;

// Render the game grid
for (let y = 0; y < gridHeight; y++) {
  for (let x = 0; x < gridWidth; x++) {
    const cell = getCell(x, y);
    let ch = hiddenChar;
    let style = styleHidden;
    
    if (cell[0] === 1) {  // Revealed
      if (cell[1] === 1) {  // Mine
        ch = mineChar;
        style = styleMine;
      } else if (cell[3] > 0) {  // Has adjacent mines
        if (cell[3] === 1) {
          ch = num1Char;
        } else if (cell[3] === 2) {
          ch = num2Char;
        } else if (cell[3] === 3) {
          ch = num3Char;
        } else if (cell[3] === 4) {
          ch = num4Char;
        } else if (cell[3] === 5) {
          ch = num5Char;
        } else if (cell[3] === 6) {
          ch = num6Char;
        } else if (cell[3] === 7) {
          ch = num7Char;
        } else if (cell[3] === 8) {
          ch = num8Char;
        }
        style = styleNumber;
      } else {  // No adjacent mines
        ch = revealedChar;
        style = styleRevealed;
      }
    } else if (cell[2] === 1) {  // Flagged
      ch = flagChar;
      style = styleFlag;
    }
    
    // Draw the character
    term.write(offsetX + (x * charWidth), offsetY + y, ch, style.fg, style.bg);
  }
}

// Show clickable buttons at top (line 1)
const buttonY = 1;
const accentStyle = getStyle("accent2");
term.write(0, buttonY, "[Easy]", accentStyle.fg);
term.write(7, buttonY, "[Medium]", accentStyle.fg);
term.write(16, buttonY, "[Hard]", accentStyle.fg);
const restartX = termWidth - 4;
if (restartX > 0) {
  term.write(restartX, buttonY, "R ", accentStyle.fg);
  term.write(restartX + 2, buttonY, "↻", styleRevealed.fg);
}

// Show status below the grid
const statusY = offsetY + gridHeight + 1;
if (gameWon) {
  const winText = "★★★ YOU WIN! ★★★";
  const winX = Math.floor(offsetX + ((gridWidth * charWidth) - winText.length) / 2);
  term.write(winX, statusY, winText, accentStyle.fg);
} else if (gameOver) {
  const loseText = "* GAME OVER *";
  const loseX = Math.floor(offsetX + ((gridWidth * charWidth) - loseText.length) / 2);
  term.write(loseX, statusY, loseText, styleMine.fg);
}

// Show stats on bottom line
const bottomY = termHeight - 1;
const statsText = `${currentDifficulty} | Mines: ${mineCount} | Flags: ${flagsPlaced}/${mineCount}`;
const statsX = Math.floor((termWidth - statsText.length) / 2);
term.write(statsX, bottomY, statsText, styleRevealed.fg);
```
