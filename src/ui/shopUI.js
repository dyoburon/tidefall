// Shop UI component for selling fish - Parchment/Merchant Style
import * as THREE from 'three';
import { isTouchDevice } from '../controls/touchControls.js';

// Sample fish data based on the fish types in fishing.js
const sampleFishInventory = {
    "Anchovy": { count: 12, value: 1, color: 0xCCCCCC },
    "Cod": { count: 8, value: 2, color: 0xBBBB88 },
    "Salmon": { count: 5, value: 3, color: 0xFF9977 },
    "Tuna": { count: 3, value: 5, color: 0x6688AA },
    "Swordfish": { count: 2, value: 10, color: 0x4477AA },
    "Shark": { count: 1, value: 20, color: 0x778899 },
    "Golden Fish": { count: 1, value: 50, color: 0xFFD700 }
};

let playerMoney = 100;
let isShopOpen = false;
let shopContainer = null;

// Create and initialize the shop UI
export function createShopUI() {
    // Create the main container
    shopContainer = document.createElement('div');
    shopContainer.id = 'shop-container';
    shopContainer.style.position = 'absolute';
    shopContainer.style.top = '50%';
    shopContainer.style.left = '50%';
    shopContainer.style.transform = 'translate(-50%, -50%)';
    shopContainer.style.width = isTouchDevice() ? '300px' : '600px';
    shopContainer.style.height = isTouchDevice() ? '300px' : '500px';
    shopContainer.style.backgroundColor = '#f0e6d2'; // Parchment color
    shopContainer.style.backgroundImage = 'url("https://www.transparenttextures.com/patterns/parchment.png")';
    shopContainer.style.borderRadius = '8px';
    shopContainer.style.border = '15px solid #5c4a36'; // Wood-like border
    shopContainer.style.borderImage = 'url("https://www.transparenttextures.com/patterns/wood-pattern.png") 20 stretch';
    shopContainer.style.boxShadow = '0 0 40px rgba(0, 0, 0, 0.7)';
    shopContainer.style.display = 'none';
    shopContainer.style.flexDirection = 'column';
    shopContainer.style.padding = '20px';
    shopContainer.style.color = '#3d2e17'; // Dark brown text
    shopContainer.style.fontFamily = '"Trattatello", "Copperplate", fantasy'; // Old-style font
    shopContainer.style.zIndex = '1000';
    shopContainer.style.overflow = 'hidden';

    // Create the header - styled as a merchant's ledger
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '2px solid #8c7b65';
    header.style.paddingBottom = '10px';
    header.style.position = 'relative';

    // Add decorative ink splotch to corner
    const inkSplotch = document.createElement('div');
    inkSplotch.style.position = 'absolute';
    inkSplotch.style.width = '50px';
    inkSplotch.style.height = '50px';
    inkSplotch.style.top = '-10px';
    inkSplotch.style.right = '-10px';
    inkSplotch.style.backgroundImage = 'url("https://www.transparenttextures.com/patterns/brushed-alum-dark.png")';
    inkSplotch.style.backgroundSize = 'cover';
    inkSplotch.style.opacity = '0.3';
    inkSplotch.style.borderRadius = '50%';
    header.appendChild(inkSplotch);

    const title = document.createElement('h2');
    title.textContent = 'Seafarer\'s Trading Post';
    title.style.margin = '0';
    title.style.fontSize = '32px';
    title.style.color = '#3d2e17';
    title.style.fontWeight = 'normal';
    title.style.letterSpacing = '1px';

    const moneyDisplay = document.createElement('div');
    moneyDisplay.id = 'player-money';
    moneyDisplay.style.fontSize = '24px';
    moneyDisplay.style.fontWeight = 'bold';
    moneyDisplay.style.color = '#8c510b';
    moneyDisplay.style.fontFamily = '"Copperplate", serif';
    moneyDisplay.textContent = `${playerMoney} coins`;

    // Add a small coin icon
    const coinIcon = document.createElement('span');
    coinIcon.textContent = "🪙 ";
    coinIcon.style.fontSize = '20px';
    moneyDisplay.prepend(coinIcon);

    header.appendChild(title);
    header.appendChild(moneyDisplay);
    shopContainer.appendChild(header);

    // Create the shop message - styled as handwritten note
    const shopMessage = document.createElement('p');
    shopMessage.textContent = "Bring yer catch to market! I pay fair prices for quality fish.";
    shopMessage.style.marginBottom = '20px';
    shopMessage.style.fontStyle = 'italic';
    shopMessage.style.fontFamily = '"Brush Script MT", cursive';
    shopMessage.style.fontSize = '18px';
    shopMessage.style.color = '#5d4825';
    shopMessage.style.textAlign = 'center';
    shopMessage.style.borderBottom = '1px dashed #8c7b65';
    shopMessage.style.paddingBottom = '10px';
    shopContainer.appendChild(shopMessage);

    // Create fish inventory container - styled as merchant's display
    const inventoryContainer = document.createElement('div');
    inventoryContainer.style.flex = '1';
    inventoryContainer.style.overflowY = 'auto';
    inventoryContainer.style.backgroundColor = 'rgba(236, 227, 206, 0.7)'; // Lighter parchment
    inventoryContainer.style.border = '2px solid #8c7b65';
    inventoryContainer.style.borderRadius = '5px';
    inventoryContainer.style.padding = '10px';
    inventoryContainer.style.marginBottom = '15px';
    inventoryContainer.style.display = 'grid';
    inventoryContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    inventoryContainer.style.gridGap = '10px';
    inventoryContainer.id = 'fish-inventory';

    // Add scroll styling to inventory
    inventoryContainer.style.scrollbarWidth = 'thin';
    inventoryContainer.style.scrollbarColor = '#8c7b65 #ece3ce';
    shopContainer.appendChild(inventoryContainer);

    // Create bottom action bar - styled as desk/counter
    const actionBar = document.createElement('div');
    actionBar.style.display = 'flex';
    actionBar.style.justifyContent = 'space-between';
    actionBar.style.marginTop = '10px';
    actionBar.style.padding = '10px';
    actionBar.style.backgroundColor = 'rgba(92, 74, 54, 0.2)'; // Wood-like background
    actionBar.style.borderRadius = '5px';
    actionBar.style.borderTop = '2px solid #8c7b65';

    // Sell All button - styled as merchant's seal
    const sellAllBtn = document.createElement('button');
    sellAllBtn.textContent = 'Sell All Fish';
    sellAllBtn.style.padding = '8px 16px';
    sellAllBtn.style.backgroundColor = '#8c510b'; // Dark gold
    sellAllBtn.style.color = '#f5eed5';
    sellAllBtn.style.border = '2px solid #614321';
    sellAllBtn.style.borderRadius = '5px';
    sellAllBtn.style.fontSize = '16px';
    sellAllBtn.style.cursor = 'pointer';
    sellAllBtn.style.transition = 'all 0.2s';
    sellAllBtn.style.fontFamily = '"Copperplate", serif';
    sellAllBtn.addEventListener('mouseenter', () => {
        sellAllBtn.style.backgroundColor = '#a46a22';
        sellAllBtn.style.transform = 'scale(1.05)';
    });
    sellAllBtn.addEventListener('mouseleave', () => {
        sellAllBtn.style.backgroundColor = '#8c510b';
        sellAllBtn.style.transform = 'scale(1)';
    });
    sellAllBtn.addEventListener('click', sellAllFish);

    // Close button - styled like a wax seal
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Ledger';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.backgroundColor = '#772f1a'; // Sealing wax color
    closeBtn.style.color = '#f5eed5';
    closeBtn.style.border = '2px solid #5a2011';
    closeBtn.style.borderRadius = '5px';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.style.fontFamily = '"Copperplate", serif';
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = '#8c3820';
        closeBtn.style.transform = 'scale(1.05)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = '#772f1a';
        closeBtn.style.transform = 'scale(1)';
    });
    closeBtn.addEventListener('click', closeShop);

    actionBar.appendChild(sellAllBtn);
    actionBar.appendChild(closeBtn);
    shopContainer.appendChild(actionBar);

    // Add shop container to the document body
    document.body.appendChild(shopContainer);

    // Create custom CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fishCardHover {
            0% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
            100% { transform: translateY(0); }
        }
        
        @keyframes coinIncrease {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); color: #8c510b; }
            100% { transform: scale(1); }
        }
        
        .sold-animation {
            animation: fadeOut 0.5s forwards;
        }
        
        @keyframes fadeOut {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);

    return {
        open: openShop,
        close: closeShop,
        update: updateShopUI,
        isOpen: () => isShopOpen
    };
}

// Open the shop and populate with fish
function openShop() {
    if (isShopOpen) return;

    isShopOpen = true;
    shopContainer.style.display = 'flex';
    updateInventoryDisplay();

    // Add opening animation
    shopContainer.style.opacity = '0';
    shopContainer.style.transform = 'translate(-50%, -53%)';
    setTimeout(() => {
        shopContainer.style.transition = 'all 0.3s ease-out';
        shopContainer.style.opacity = '1';
        shopContainer.style.transform = 'translate(-50%, -50%)';
    }, 50);
}

// Close the shop
function closeShop() {
    if (!isShopOpen) return;

    // Add closing animation
    shopContainer.style.transition = 'all 0.3s ease-in';
    shopContainer.style.opacity = '0';
    shopContainer.style.transform = 'translate(-50%, -53%)';

    setTimeout(() => {
        shopContainer.style.display = 'none';
        isShopOpen = false;
    }, 300);
}

// Update the shop with new data
function updateShopUI(fishData, money) {
    if (fishData) {
        Object.assign(sampleFishInventory, fishData);
    }

    if (money !== undefined) {
        playerMoney = money;
    }

    if (isShopOpen) {
        updateInventoryDisplay();
        updateMoneyDisplay();
    }
}

// Update the inventory display
function updateInventoryDisplay() {
    const inventoryContainer = document.getElementById('fish-inventory');
    inventoryContainer.innerHTML = '';

    // Add fish cards
    Object.entries(sampleFishInventory).forEach(([fishName, fishData]) => {
        if (fishData.count > 0) {
            inventoryContainer.appendChild(createFishCard(fishName, fishData));
        }
    });

    // Add empty message if no fish
    if (inventoryContainer.children.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = "Ye haven't any fish to sell, sailor!";
        emptyMessage.style.gridColumn = '1 / span 2';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.color = '#8c7b65';
        emptyMessage.style.fontStyle = 'italic';
        emptyMessage.style.fontFamily = '"Brush Script MT", cursive';
        emptyMessage.style.fontSize = '18px';
        inventoryContainer.appendChild(emptyMessage);
    }
}

// Create a card for a fish type
function createFishCard(fishName, fishData) {
    const card = document.createElement('div');
    card.className = 'fish-card';
    card.style.backgroundColor = 'rgba(236, 227, 206, 0.9)';
    card.style.borderRadius = '5px';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.transition = 'all 0.2s';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.border = '1px solid #8c7b65';
    card.style.boxShadow = 'inset 0 0 10px rgba(92, 74, 54, 0.2)';

    // Add fish ink stamp effect in the background
    const stampEffect = document.createElement('div');
    stampEffect.style.position = 'absolute';
    stampEffect.style.right = '5px';
    stampEffect.style.bottom = '5px';
    stampEffect.style.width = '40px';
    stampEffect.style.height = '40px';
    stampEffect.style.opacity = '0.1';
    stampEffect.style.backgroundImage = 'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")';
    stampEffect.style.borderRadius = '50%';
    stampEffect.style.transform = 'rotate(15deg)';
    card.appendChild(stampEffect);

    // Add hover effect
    card.addEventListener('mouseenter', () => {
        card.style.backgroundColor = 'rgba(246, 237, 216, 0.95)';
        card.style.borderColor = '#614321';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(92, 74, 54, 0.2)';
    });

    card.addEventListener('mouseleave', () => {
        card.style.backgroundColor = 'rgba(236, 227, 206, 0.9)';
        card.style.borderColor = '#8c7b65';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'inset 0 0 10px rgba(92, 74, 54, 0.2)';
    });

    // Fish icon (colored square with fish-like shape)
    const fishIcon = document.createElement('div');
    fishIcon.style.width = '40px';
    fishIcon.style.height = '25px';
    fishIcon.style.backgroundColor = `#${fishData.color.toString(16).padStart(6, '0')}`;
    fishIcon.style.borderRadius = '5px';
    fishIcon.style.marginRight = '15px';
    fishIcon.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.2)';
    fishIcon.style.position = 'relative';

    // Add fish tail to make it look more like a fish
    const fishTail = document.createElement('div');
    fishTail.style.position = 'absolute';
    fishTail.style.right = '-8px';
    fishTail.style.top = '50%';
    fishTail.style.transform = 'translateY(-50%)';
    fishTail.style.width = '10px';
    fishTail.style.height = '15px';
    fishTail.style.backgroundColor = `#${fishData.color.toString(16).padStart(6, '0')}`;
    fishTail.style.clipPath = 'polygon(0 0, 0 100%, 100% 50%)';
    fishIcon.appendChild(fishTail);

    card.appendChild(fishIcon);

    // Fish info
    const fishInfo = document.createElement('div');
    fishInfo.style.flex = '1';

    const fishNameEl = document.createElement('div');
    fishNameEl.textContent = fishName;
    fishNameEl.style.fontWeight = 'bold';
    fishNameEl.style.marginBottom = '5px';
    fishNameEl.style.fontFamily = '"Copperplate", serif';
    fishInfo.appendChild(fishNameEl);

    const fishDetails = document.createElement('div');
    fishDetails.style.display = 'flex';
    fishDetails.style.justifyContent = 'space-between';
    fishDetails.style.fontSize = '14px';
    fishDetails.style.color = '#5d4825';

    const countEl = document.createElement('span');
    countEl.textContent = `Quantity: ${fishData.count}`;
    countEl.style.fontFamily = '"Courier New", monospace';

    const valueEl = document.createElement('span');
    valueEl.textContent = `Value: ${fishData.value}`;
    valueEl.style.fontFamily = '"Courier New", monospace';

    fishDetails.appendChild(countEl);
    fishDetails.appendChild(valueEl);
    fishInfo.appendChild(fishDetails);

    card.appendChild(fishInfo);

    // Sell button - styled like a merchant's stamp
    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell';
    sellBtn.style.backgroundColor = '#8c510b';
    sellBtn.style.color = '#f5eed5';
    sellBtn.style.border = '1px solid #614321';
    sellBtn.style.borderRadius = '5px';
    sellBtn.style.padding = '6px 10px';
    sellBtn.style.marginLeft = '10px';
    sellBtn.style.cursor = 'pointer';
    sellBtn.style.transition = 'all 0.2s';
    sellBtn.style.fontFamily = '"Copperplate", serif';
    sellBtn.style.fontSize = '14px';

    sellBtn.addEventListener('mouseenter', () => {
        sellBtn.style.backgroundColor = '#a46a22';
        sellBtn.style.transform = 'scale(1.05)';
    });

    sellBtn.addEventListener('mouseleave', () => {
        sellBtn.style.backgroundColor = '#8c510b';
        sellBtn.style.transform = 'scale(1)';
    });

    sellBtn.addEventListener('click', () => sellFish(fishName));

    card.appendChild(sellBtn);

    return card;
}

// Sell a specific fish
function sellFish(fishName) {
    if (!sampleFishInventory[fishName] || sampleFishInventory[fishName].count <= 0) return;

    const fish = sampleFishInventory[fishName];
    const value = fish.value;

    // Update inventory and money
    fish.count--;
    playerMoney += value;

    // Play sell animation
    playSellAnimation(fishName, value);

    // Update displays
    updateInventoryDisplay();
    updateMoneyDisplay(true);

    // If no more fish left, update UI
    if (fish.count === 0) {
        setTimeout(() => {
            updateInventoryDisplay();
        }, 500);
    }
}

// Sell all fish at once
function sellAllFish() {
    let totalValue = 0;
    let hasFish = false;

    // Calculate total value and check if any fish exist
    Object.entries(sampleFishInventory).forEach(([fishName, fishData]) => {
        if (fishData.count > 0) {
            totalValue += fishData.count * fishData.value;
            fishData.count = 0;
            hasFish = true;
        }
    });

    if (!hasFish) return;

    // Update money
    playerMoney += totalValue;

    // Play animation for selling all
    playSellAllAnimation(totalValue);

    // Update displays
    updateInventoryDisplay();
    updateMoneyDisplay(true);
}

// Update the money display
function updateMoneyDisplay(animate = false) {
    const moneyDisplay = document.getElementById('player-money');
    moneyDisplay.textContent = `${playerMoney} coins`;

    // Add coin icon back (it gets removed when we set textContent)
    const coinIcon = document.createElement('span');
    coinIcon.textContent = "🪙 ";
    coinIcon.style.fontSize = '20px';
    moneyDisplay.prepend(coinIcon);

    if (animate) {
        moneyDisplay.style.animation = 'none';
        // Trigger reflow
        void moneyDisplay.offsetWidth;
        moneyDisplay.style.animation = 'coinIncrease 0.6s';
    }
}

// Animation for selling a single fish
function playSellAnimation(fishName, value) {
    // Find the card for this fish
    const cards = document.querySelectorAll('.fish-card');
    let targetCard = null;

    cards.forEach(card => {
        if (card.querySelector('div').nextSibling.firstChild.textContent === fishName) {
            targetCard = card;
        }
    });

    if (!targetCard) return;

    // Create floating value indicator
    const valueIndicator = document.createElement('div');
    valueIndicator.textContent = `+${value}`;
    valueIndicator.style.position = 'absolute';
    valueIndicator.style.top = '50%';
    valueIndicator.style.right = '20px';
    valueIndicator.style.color = '#8c510b';
    valueIndicator.style.fontWeight = 'bold';
    valueIndicator.style.fontSize = '18px';
    valueIndicator.style.pointerEvents = 'none';
    valueIndicator.style.fontFamily = '"Copperplate", serif';
    valueIndicator.className = 'sold-animation';

    targetCard.appendChild(valueIndicator);

    // Remove after animation completes
    setTimeout(() => {
        if (valueIndicator.parentNode) {
            valueIndicator.parentNode.removeChild(valueIndicator);
        }
    }, 600);
}

// Animation for selling all fish
function playSellAllAnimation(totalValue) {
    const inventoryContainer = document.getElementById('fish-inventory');

    // Create a large floating value indicator
    const valueIndicator = document.createElement('div');
    valueIndicator.textContent = `+${totalValue}`;
    valueIndicator.style.position = 'absolute';
    valueIndicator.style.top = '50%';
    valueIndicator.style.left = '50%';
    valueIndicator.style.transform = 'translate(-50%, -50%)';
    valueIndicator.style.color = '#8c510b';
    valueIndicator.style.fontWeight = 'bold';
    valueIndicator.style.fontSize = '32px';
    valueIndicator.style.pointerEvents = 'none';
    valueIndicator.style.zIndex = '10';
    valueIndicator.style.textShadow = '0 0 10px rgba(140, 81, 11, 0.5)';
    valueIndicator.style.fontFamily = '"Copperplate", serif';
    valueIndicator.className = 'sold-animation';

    inventoryContainer.appendChild(valueIndicator);

    // Remove after animation completes
    setTimeout(() => {
        if (valueIndicator.parentNode) {
            valueIndicator.parentNode.removeChild(valueIndicator);
        }
    }, 800);
}

// Export the public interface
export const ShopUI = {
    create: createShopUI
}; 