// InventoryUI.js - Manages all inventory-related UI components

import { getPlayerInventory } from '../core/network.js';
import { isTouchDevice } from '../controls/touchControls.js';

class InventoryUI {
    constructor() {
        // Initialize elements container to store references to UI components
        this.elements = {
            chest: null,
            panel: null,
            fishContent: null,
            treasureContent: null,
            cargoContent: null
        };

        // Track if the inventory is currently open
        this.isOpen = false;

        // Make the instance globally accessible
        window.inventoryUI = this;
    }

    // Create the inventory chest and panel
    createInventory() {
        // Create inventory chest container (the icon)
        const inventoryChest = document.createElement('div');
        inventoryChest.style.position = 'absolute';
        inventoryChest.style.top = '15px';
        inventoryChest.style.right = '60px';
        inventoryChest.style.width = isTouchDevice() ? '48px' : '65px';
        inventoryChest.style.height = isTouchDevice() ? '44px' : '60px';
        inventoryChest.style.cursor = 'pointer';
        inventoryChest.style.transition = 'transform 0.3s';
        inventoryChest.style.zIndex = '100';
        inventoryChest.style.pointerEvents = 'auto';
        inventoryChest.style.perspective = '300px';

        // Create a back panel for the chest that will be visible during lid animation
        const chestBackPanel = document.createElement('div');
        chestBackPanel.style.position = 'absolute';
        chestBackPanel.style.width = '100%';
        chestBackPanel.style.height = '90%';
        chestBackPanel.style.backgroundColor = '#5D2906'; // Darker brown than chest body
        chestBackPanel.style.borderRadius = '5px'; // Slightly smaller radius to appear behind
        chestBackPanel.style.zIndex = '-1'; // Position it behind other chest elements
        chestBackPanel.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';
        inventoryChest.appendChild(chestBackPanel);

        // Create chest body - simplified styling
        const chestBody = document.createElement('div');
        chestBody.className = 'chest-body';
        chestBody.style.position = 'absolute';
        chestBody.style.width = '100%';
        chestBody.style.height = '60%';
        chestBody.style.bottom = '0';
        chestBody.style.backgroundColor = '#8B4513'; // Brown color
        chestBody.style.borderRadius = '0 0 8px 8px';
        chestBody.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.3)';
        chestBody.style.border = '1px solid rgba(0, 0, 0, 0.3)';

        // Create chest lid with transform capabilities - proper back-hinge opening
        const chestLid = document.createElement('div');
        chestLid.className = 'chest-lid';
        chestLid.style.position = 'absolute';
        chestLid.style.width = '100%';
        chestLid.style.height = '45%';
        chestLid.style.top = '0';
        chestLid.style.backgroundColor = '#A0522D'; // Slightly lighter brown
        chestLid.style.borderRadius = '8px 8px 0 0';
        chestLid.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.4)';
        // Changed to back-edge opening for traditional chest
        chestLid.style.transformOrigin = 'center top';
        chestLid.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
        chestLid.style.border = '1px solid rgba(0, 0, 0, 0.3)';

        // Add interior of the lid (visible when open)
        const lidInterior = document.createElement('div');
        lidInterior.style.position = 'absolute';
        lidInterior.style.width = '90%';
        lidInterior.style.height = '90%';
        lidInterior.style.top = '10%';
        lidInterior.style.left = '5%';
        lidInterior.style.backgroundColor = '#654321';
        lidInterior.style.borderRadius = '5px 5px 0 0';
        lidInterior.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';
        lidInterior.style.opacity = '0'; // Hidden initially
        lidInterior.style.transition = 'opacity 0.3s';
        chestLid.appendChild(lidInterior);

        // Create simplified lock/clasp at the front edge
        const chestLock = document.createElement('div');
        chestLock.className = 'chest-lock';
        chestLock.style.position = 'absolute';
        chestLock.style.width = '12px';
        chestLock.style.height = '14px';
        chestLock.style.top = '100%'; // Position it at bottom of lid, extending down
        chestLock.style.left = '50%';
        chestLock.style.transform = 'translateX(-50%)';
        chestLock.style.backgroundColor = '#DAA520'; // Gold color
        chestLock.style.borderRadius = '0 0 3px 3px';
        chestLock.style.boxShadow = '0 2px 3px rgba(0, 0, 0, 0.4)';
        chestLock.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
        chestLid.appendChild(chestLock);

        // Add keyhole to lock - simple circle
        const keyhole = document.createElement('div');
        keyhole.style.position = 'absolute';
        keyhole.style.width = '5px';
        keyhole.style.height = '5px';
        keyhole.style.top = '7px';
        keyhole.style.left = '50%';
        keyhole.style.transform = 'translateX(-50%)';
        keyhole.style.backgroundColor = '#333';
        keyhole.style.borderRadius = '50%';
        chestLock.appendChild(keyhole);

        // Add lock plate on the body that the lock closes onto
        const lockPlate = document.createElement('div');
        lockPlate.style.position = 'absolute';
        lockPlate.style.width = '14px';
        lockPlate.style.height = '5px';
        lockPlate.style.top = '0';
        lockPlate.style.left = '50%';
        lockPlate.style.transform = 'translateX(-50%)';
        lockPlate.style.backgroundColor = '#DAA520'; // Gold color
        lockPlate.style.borderRadius = '0 0 3px 3px';
        chestBody.appendChild(lockPlate);

        // Create wood grain lines - limited to just a few
        const createWoodGrain = (parent, top, width) => {
            const grain = document.createElement('div');
            grain.style.position = 'absolute';
            grain.style.height = '1px';
            grain.style.width = `${width}%`;
            grain.style.top = `${top}%`;
            grain.style.left = `${(100 - width) / 2}%`;
            grain.style.backgroundColor = 'rgba(101, 67, 33, 0.5)';
            parent.appendChild(grain);
        };

        // Add just a few wood grain lines
        createWoodGrain(chestBody, 30, 85);
        createWoodGrain(chestBody, 70, 90);
        createWoodGrain(chestLid, 50, 85);

        // Create the interior treasure area
        const treasureArea = document.createElement('div');
        treasureArea.style.position = 'absolute';
        treasureArea.style.width = '90%';
        treasureArea.style.height = '80%';
        treasureArea.style.top = '10%';
        treasureArea.style.left = '5%';
        treasureArea.style.backgroundColor = '#654321'; // Dark brown interior
        treasureArea.style.borderRadius = '0 0 5px 5px';
        treasureArea.style.boxShadow = 'inset 0 0 10px rgba(0, 0, 0, 0.7)';
        treasureArea.style.overflow = 'hidden';
        chestBody.appendChild(treasureArea);

        // Assemble the chest
        inventoryChest.appendChild(chestBody);
        inventoryChest.appendChild(chestLid);
        document.body.appendChild(inventoryChest);

        // Proper chest opening animation with lid opening backward
        inventoryChest.addEventListener('mouseover', () => {
            // Open lid backward with proper physics
            chestLid.style.transform = 'rotateX(-100deg)';
            inventoryChest.style.transform = 'scale(1.05)';

            // Show interior of lid as it opens
            lidInterior.style.opacity = '1';

            // Reveal coins with slight delay for effect
            const coins = treasureArea.querySelectorAll('.treasure-coin');
            coins.forEach((coin, index) => {
                setTimeout(() => {
                    coin.style.opacity = '1';
                }, 150 + (index * 50));
            });
        });

        inventoryChest.addEventListener('mouseout', () => {
            // Close lid
            chestLid.style.transform = 'rotateX(0deg)';
            inventoryChest.style.transform = 'scale(1)';

            // Hide interior of lid
            lidInterior.style.opacity = '0';

            // Hide coins
            const coins = treasureArea.querySelectorAll('.treasure-coin');
            coins.forEach(coin => {
                coin.style.opacity = '0';
            });
        });

        // Create inventory panel (hidden by default, now with chest design)
        const inventoryPanel = document.createElement('div');
        inventoryPanel.style.position = 'absolute';
        inventoryPanel.style.top = '50%';
        inventoryPanel.style.left = '50%';
        inventoryPanel.style.transform = 'translate(-50%, -50%)';
        inventoryPanel.style.width = isTouchDevice() ? '300px' : '600px';
        inventoryPanel.style.height = isTouchDevice() ? '200px' : '400px';
        inventoryPanel.style.backgroundColor = '#8B4513'; // Wood brown color
        inventoryPanel.style.border = '8px solid #A0522D'; // Lighter wood border
        inventoryPanel.style.borderRadius = '10px';
        inventoryPanel.style.padding = '20px';
        inventoryPanel.style.display = 'none';
        inventoryPanel.style.flexDirection = 'column';
        inventoryPanel.style.zIndex = '1000';
        inventoryPanel.style.pointerEvents = 'auto';
        inventoryPanel.style.color = 'white';
        inventoryPanel.style.fontFamily = 'Arial, sans-serif';
        inventoryPanel.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 30px rgba(0, 0, 0, 0.4)';
        document.body.appendChild(inventoryPanel);

        // Add decorative metal corners to the panel
        const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        corners.forEach(position => {
            const corner = document.createElement('div');
            corner.style.position = 'absolute';
            corner.style.width = '30px';
            corner.style.height = '30px';
            corner.style.backgroundColor = '#DAA520'; // Gold color
            corner.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';

            if (position === 'top-left') {
                corner.style.top = '0';
                corner.style.left = '0';
                corner.style.borderTopLeftRadius = '5px';
                corner.style.borderRight = '1px solid #8B4513';
                corner.style.borderBottom = '1px solid #8B4513';
            } else if (position === 'top-right') {
                corner.style.top = '0';
                corner.style.right = '0';
                corner.style.borderTopRightRadius = '5px';
                corner.style.borderLeft = '1px solid #8B4513';
                corner.style.borderBottom = '1px solid #8B4513';
            } else if (position === 'bottom-left') {
                corner.style.bottom = '0';
                corner.style.left = '0';
                corner.style.borderBottomLeftRadius = '5px';
                corner.style.borderRight = '1px solid #8B4513';
                corner.style.borderTop = '1px solid #8B4513';
            } else {
                corner.style.bottom = '0';
                corner.style.right = '0';
                corner.style.borderBottomRightRadius = '5px';
                corner.style.borderLeft = '1px solid #8B4513';
                corner.style.borderTop = '1px solid #8B4513';
            }

            inventoryPanel.appendChild(corner);
        });

        // Add wood grain texture effect
        for (let i = 0; i < 8; i++) {
            const grain = document.createElement('div');
            grain.style.position = 'absolute';
            grain.style.left = '0';
            grain.style.right = '0';
            grain.style.height = '1px';
            grain.style.top = `${50 + (i * 40)}px`;
            grain.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            grain.style.zIndex = '1';
            inventoryPanel.appendChild(grain);
        }

        // Inventory header with chest-like design
        const inventoryHeader = document.createElement('div');
        inventoryHeader.style.display = 'flex';
        inventoryHeader.style.justifyContent = 'space-between';
        inventoryHeader.style.alignItems = 'center';
        inventoryHeader.style.marginBottom = '20px';
        inventoryHeader.style.padding = '5px 10px';
        inventoryHeader.style.backgroundColor = '#654321'; // Darker wood for header
        inventoryHeader.style.borderRadius = '5px';
        inventoryHeader.style.border = '2px solid #DAA520'; // Gold border
        inventoryHeader.style.boxShadow = 'inset 0 0 10px rgba(0, 0, 0, 0.3)';
        inventoryHeader.style.position = 'relative';
        inventoryHeader.style.zIndex = '2';
        inventoryPanel.appendChild(inventoryHeader);

        // Inventory title - styled as metal plate
        const inventoryTitle = document.createElement('h2');
        inventoryTitle.textContent = 'Inventory';
        inventoryTitle.style.margin = '0';
        inventoryTitle.style.color = '#FFD700'; // Gold text
        inventoryTitle.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.6)';
        inventoryTitle.style.fontFamily = "'Times New Roman', serif";
        inventoryTitle.style.fontWeight = 'bold';
        inventoryHeader.appendChild(inventoryTitle);

        // Close button styled as a metal clasp
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.backgroundColor = '#DAA520'; // Gold color
        closeButton.style.border = '2px solid #B8860B'; // Darker gold border
        closeButton.style.color = '#654321'; // Dark wood color
        closeButton.style.fontSize = isTouchDevice() ? '12px' : '16px';
        closeButton.style.fontWeight = 'bold';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '2px 8px';
        closeButton.style.borderRadius = '5px';
        closeButton.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.5)';
        closeButton.style.transition = 'all 0.2s';

        // Add click event to close the inventory
        closeButton.addEventListener('click', () => {
            this.toggleInventory(false); // Close the inventory
        });

        closeButton.addEventListener('mouseover', () => {
            closeButton.style.backgroundColor = '#FFD700';
            closeButton.style.transform = 'scale(1.05)';
        });
        closeButton.addEventListener('mouseout', () => {
            closeButton.style.backgroundColor = '#DAA520';
            closeButton.style.transform = 'scale(1)';
        });
        inventoryHeader.appendChild(closeButton);

        // Tabs styled as metal plates or labels on a chest
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.marginBottom = '15px';
        tabsContainer.style.position = 'relative';
        tabsContainer.style.zIndex = '2';
        inventoryPanel.appendChild(tabsContainer);

        // Function to create styled tabs
        const createTab = (text, isActive = false) => {
            const tab = document.createElement('div');
            tab.textContent = text;
            tab.style.padding = '8px 15px';
            tab.style.marginRight = '10px';
            tab.style.cursor = 'pointer';
            tab.style.backgroundColor = isActive ? '#DAA520' : '#B8860B'; // Gold for active, darker for inactive
            tab.style.color = '#FFF8DC'; // Cream color
            tab.style.borderTopLeftRadius = '5px';
            tab.style.borderTopRightRadius = '5px';
            tab.style.boxShadow = isActive ? '0 -1px 5px rgba(0, 0, 0, 0.3)' : '0 -1px 3px rgba(0, 0, 0, 0.2)';
            tab.style.transition = 'all 0.2s';
            tab.style.border = '1px solid #654321'; // Dark wood color
            tab.style.borderBottom = isActive ? '1px solid #DAA520' : '1px solid #B8860B';
            tab.style.textShadow = '0 1px 1px rgba(0, 0, 0, 0.5)';
            tab.style.fontWeight = isActive ? 'bold' : 'normal';
            tab.style.transform = isActive ? 'translateY(-2px)' : 'translateY(0)';
            tab.dataset.active = isActive ? 'true' : 'false';
            return tab;
        };

        // Create tabs with new styling
        const fishTab = createTab('Fish', true);
        const treasureTab = createTab('Treasures');
        const cargoTab = createTab('Cargo');

        tabsContainer.appendChild(fishTab);
        tabsContainer.appendChild(treasureTab);
        tabsContainer.appendChild(cargoTab);

        // Content area styled as the inside of a chest
        const contentArea = document.createElement('div');
        contentArea.style.flex = '1';
        contentArea.style.overflowY = 'auto';
        contentArea.style.padding = '15px';
        contentArea.style.backgroundColor = '#654321'; // Dark wood interior
        contentArea.style.borderRadius = '5px';
        contentArea.style.border = '3px solid #B8860B'; // Dark gold border
        contentArea.style.boxShadow = 'inset 0 0 15px rgba(0, 0, 0, 0.5)';
        contentArea.style.position = 'relative';
        contentArea.style.zIndex = '2';
        inventoryPanel.appendChild(contentArea);

        // Add a subtle fabric texture to the interior
        const fabricTexture = document.createElement('div');
        fabricTexture.style.position = 'absolute';
        fabricTexture.style.top = '0';
        fabricTexture.style.left = '0';
        fabricTexture.style.right = '0';
        fabricTexture.style.bottom = '0';
        fabricTexture.style.opacity = '0.1';
        fabricTexture.style.backgroundImage = 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%)';
        fabricTexture.style.backgroundSize = '4px 4px';
        fabricTexture.style.pointerEvents = 'none';
        contentArea.appendChild(fabricTexture);

        // Fish inventory content (visible by default)
        const fishContent = document.createElement('div');
        fishContent.id = 'fish-inventory';
        fishContent.style.display = 'flex';
        fishContent.style.flexDirection = 'column';
        fishContent.style.gap = '15px';
        fishContent.style.position = 'relative';
        fishContent.style.zIndex = '3';
        contentArea.appendChild(fishContent);

        // Treasure inventory content (hidden by default)
        const treasureContent = document.createElement('div');
        treasureContent.id = 'treasure-inventory';
        treasureContent.style.display = 'none';
        treasureContent.textContent = 'No treasures found yet. Explore more islands!';
        treasureContent.style.textAlign = 'center';
        treasureContent.style.padding = '20px';
        treasureContent.style.color = '#FFD700'; // Gold color
        treasureContent.style.fontStyle = 'italic';
        treasureContent.style.position = 'relative';
        treasureContent.style.zIndex = '3';
        contentArea.appendChild(treasureContent);

        // Cargo inventory content (hidden by default)
        const cargoContent = document.createElement('div');
        cargoContent.id = 'cargo-inventory';
        cargoContent.style.display = 'none';
        cargoContent.style.position = 'relative';
        cargoContent.style.zIndex = '3';
        cargoContent.style.padding = '10px';

        // Add a sample cannon item 
        const cannonItem = document.createElement('div');
        cannonItem.style.display = 'flex';
        cannonItem.style.alignItems = 'center';
        cannonItem.style.backgroundColor = 'rgba(50, 40, 30, 0.7)';
        cannonItem.style.borderRadius = '8px';
        cannonItem.style.padding = '10px 15px';
        cannonItem.style.marginBottom = '10px';
        cannonItem.style.border = '2px solid #B8860B'; // Gold border
        cannonItem.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';

        // Cannon icon/image placeholder
        const cannonIcon = document.createElement('div');
        cannonIcon.style.width = '40px';
        cannonIcon.style.height = '40px';
        cannonIcon.style.backgroundColor = '#333';
        cannonIcon.style.borderRadius = '5px';
        cannonIcon.style.marginRight = '15px';
        cannonIcon.style.position = 'relative';
        cannonIcon.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';

        // Add a simple cannon shape inside the icon
        const cannonBarrel = document.createElement('div');
        cannonBarrel.style.position = 'absolute';
        cannonBarrel.style.width = '25px';
        cannonBarrel.style.height = '12px';
        cannonBarrel.style.backgroundColor = '#666';
        cannonBarrel.style.top = '14px';
        cannonBarrel.style.left = '10px';
        cannonBarrel.style.borderRadius = '3px';
        cannonIcon.appendChild(cannonBarrel);

        const cannonBase = document.createElement('div');
        cannonBase.style.position = 'absolute';
        cannonBase.style.width = '20px';
        cannonBase.style.height = '20px';
        cannonBase.style.backgroundColor = '#555';
        cannonBase.style.borderRadius = '50%';
        cannonBase.style.bottom = '5px';
        cannonBase.style.left = '10px';
        cannonIcon.appendChild(cannonBase);

        // Cannon details
        const cannonDetails = document.createElement('div');
        cannonDetails.style.flex = '1';

        const cannonName = document.createElement('div');
        cannonName.textContent = 'Cannons';
        cannonName.style.fontWeight = 'bold';
        cannonName.style.fontSize = isTouchDevice() ? '12px' : '16px';
        cannonName.style.color = '#FFD700'; // Gold text
        cannonName.style.marginBottom = '4px';

        const cannonCount = document.createElement('div');
        cannonCount.textContent = 'Quantity: 200';
        cannonCount.style.color = '#FFF';
        cannonCount.style.fontSize = isTouchDevice() ? '10px' : '14px';

        cannonDetails.appendChild(cannonName);
        cannonDetails.appendChild(cannonCount);

        // Assemble the cannon item
        cannonItem.appendChild(cannonIcon);
        cannonItem.appendChild(cannonDetails);
        cargoContent.appendChild(cannonItem);

        // Add a message for other cargo items
        const otherCargoMsg = document.createElement('div');
        otherCargoMsg.textContent = 'Find more equipment for your ship!';
        otherCargoMsg.style.textAlign = 'center';
        otherCargoMsg.style.padding = '15px';
        otherCargoMsg.style.color = '#FFD700'; // Gold color
        otherCargoMsg.style.fontStyle = 'italic';
        cargoContent.appendChild(otherCargoMsg);

        contentArea.appendChild(cargoContent);

        // Update tab click events for new styling
        fishTab.addEventListener('click', () => {
            fishTab.style.backgroundColor = '#DAA520';
            fishTab.style.fontWeight = 'bold';
            fishTab.style.transform = 'translateY(-2px)';
            fishTab.style.boxShadow = '0 -1px 5px rgba(0, 0, 0, 0.3)';
            fishTab.style.borderBottom = '1px solid #DAA520';
            fishTab.dataset.active = 'true';

            treasureTab.style.backgroundColor = '#B8860B';
            treasureTab.style.fontWeight = 'normal';
            treasureTab.style.transform = 'translateY(0)';
            treasureTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            treasureTab.style.borderBottom = '1px solid #B8860B';
            treasureTab.dataset.active = 'false';

            cargoTab.style.backgroundColor = '#B8860B';
            cargoTab.style.fontWeight = 'normal';
            cargoTab.style.transform = 'translateY(0)';
            cargoTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            cargoTab.style.borderBottom = '1px solid #B8860B';
            cargoTab.dataset.active = 'false';

            fishContent.style.display = 'flex';
            treasureContent.style.display = 'none';
            cargoContent.style.display = 'none';
        });

        treasureTab.addEventListener('click', () => {
            treasureTab.style.backgroundColor = '#DAA520';
            treasureTab.style.fontWeight = 'bold';
            treasureTab.style.transform = 'translateY(-2px)';
            treasureTab.style.boxShadow = '0 -1px 5px rgba(0, 0, 0, 0.3)';
            treasureTab.style.borderBottom = '1px solid #DAA520';
            treasureTab.dataset.active = 'true';

            fishTab.style.backgroundColor = '#B8860B';
            fishTab.style.fontWeight = 'normal';
            fishTab.style.transform = 'translateY(0)';
            fishTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            fishTab.style.borderBottom = '1px solid #B8860B';
            fishTab.dataset.active = 'false';

            cargoTab.style.backgroundColor = '#B8860B';
            cargoTab.style.fontWeight = 'normal';
            cargoTab.style.transform = 'translateY(0)';
            cargoTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            cargoTab.style.borderBottom = '1px solid #B8860B';
            cargoTab.dataset.active = 'false';

            treasureContent.style.display = 'block';
            fishContent.style.display = 'none';
            cargoContent.style.display = 'none';
        });

        cargoTab.addEventListener('click', () => {
            cargoTab.style.backgroundColor = '#DAA520';
            cargoTab.style.fontWeight = 'bold';
            cargoTab.style.transform = 'translateY(-2px)';
            cargoTab.style.boxShadow = '0 -1px 5px rgba(0, 0, 0, 0.3)';
            cargoTab.style.borderBottom = '1px solid #DAA520';
            cargoTab.dataset.active = 'true';

            fishTab.style.backgroundColor = '#B8860B';
            fishTab.style.fontWeight = 'normal';
            fishTab.style.transform = 'translateY(0)';
            fishTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            fishTab.style.borderBottom = '1px solid #B8860B';
            fishTab.dataset.active = 'false';

            treasureTab.style.backgroundColor = '#B8860B';
            treasureTab.style.fontWeight = 'normal';
            treasureTab.style.transform = 'translateY(0)';
            treasureTab.style.boxShadow = '0 -1px 3px rgba(0, 0, 0, 0.2)';
            treasureTab.style.borderBottom = '1px solid #B8860B';
            treasureTab.dataset.active = 'false';

            cargoContent.style.display = 'block';
            fishContent.style.display = 'none';
            treasureContent.style.display = 'none';
        });

        // Toggle inventory when chest is clicked
        inventoryChest.addEventListener('click', () => {
            if (inventoryPanel.style.display === 'none') {
                // Play chest opening sound
                this.playChestOpenSound();

                // ADDED: Fetch fresh inventory data when opening

                getPlayerInventory((inventoryData) => {
                    if (inventoryData) {


                        // Update fish inventory display
                        if (inventoryData.fish) {
                            this.updateInventory(inventoryData.fish);
                        }

                        // Update treasure inventory display
                        if (inventoryData.treasures) {
                            this.updateTreasureInventory(inventoryData.treasures);
                        }

                        // Future: Handle cargo inventory if implemented
                        // if (inventoryData.cargo) {
                        //     this.updateCargoInventory(inventoryData.cargo);
                        // }
                    } else {

                    }
                });

                inventoryPanel.style.display = 'flex';
                this.isOpen = true;
                // Register this as an open UI with the main game UI if available
                if (typeof this.registerOpenUI === 'function') {
                    this.registerOpenUI('inventory');
                }
            } else {
                // Play chest closing sound (slightly different)
                this.playChestCloseSound();

                inventoryPanel.style.display = 'none';
                this.isOpen = false;
                // Unregister this as an open UI if available
                if (typeof this.unregisterOpenUI === 'function') {
                    this.unregisterOpenUI('inventory');
                }
            }
        });

        // Store references to important elements
        this.elements.chest = inventoryChest;
        this.elements.panel = inventoryPanel;
        this.elements.fishContent = fishContent;
        this.elements.treasureContent = treasureContent;
        this.elements.cargoContent = cargoContent;

        return inventoryChest;
    }

    // Function to update inventory content
    updateContent() {
        // This will be overridden by the main UI class
    }

    // Update fish inventory display
    updateInventory(fishInventory) {
        const fishContent = this.elements.fishContent;
        if (!fishContent) return;

        // Clear existing content
        fishContent.innerHTML = '';

        // Check for proper data format
        if (!fishInventory || (Array.isArray(fishInventory) && fishInventory.length === 0) ||
            (typeof fishInventory === 'object' && Object.keys(fishInventory).length === 0)) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = 'No fish caught yet. Try fishing!';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.color = 'rgba(200, 200, 200, 0.7)';
            fishContent.appendChild(emptyMessage);
            return;
        }

        // Process the fish data into a standardized format
        // This handles both array format from server and object format
        let processedFish = {};

        if (Array.isArray(fishInventory)) {
            // Server format: array of fish objects
            fishInventory.forEach(fish => {
                const fishName = fish.name || 'Unknown Fish';
                if (!processedFish[fishName]) {
                    processedFish[fishName] = {
                        name: fishName,
                        count: 1,
                        value: fish.data?.value || 1,
                        color: fish.data?.color || 0x6699CC
                    };
                } else {
                    processedFish[fishName].count += 1;
                }
            });
        } else {
            // Handle existing object format
            processedFish = fishInventory;
        }

        // Define fish tiers
        const tiers = [
            { name: "Legendary", color: "#FFD700", fishes: [] },  // Gold
            { name: "Rare", color: "#9370DB", fishes: [] },       // Purple
            { name: "Uncommon", color: "#32CD32", fishes: [] },   // Green
            { name: "Common", color: "#B0C4DE", fishes: [] }      // Light blue
        ];

        // Sort fish into tiers
        for (const [fishName, fishData] of Object.entries(processedFish)) {
            // Ensure count and value have defaults
            const safeData = {
                ...fishData,
                name: fishName,
                count: fishData.count !== undefined ? fishData.count : 1,
                value: fishData.value !== undefined ? fishData.value : 1
            };

            if (safeData.value >= 20) {
                tiers[0].fishes.push(safeData);
            } else if (safeData.value >= 5) {
                tiers[1].fishes.push(safeData);
            } else if (safeData.value >= 2) {
                tiers[2].fishes.push(safeData);
            } else {
                tiers[3].fishes.push(safeData);
            }
        }

        // Create tier sections
        tiers.forEach(tier => {
            if (tier.fishes.length === 0) return; // Skip empty tiers

            // Create tier header
            const tierSection = document.createElement('div');
            tierSection.style.marginBottom = '15px';

            const tierHeader = document.createElement('div');
            tierHeader.textContent = tier.name;
            tierHeader.style.fontSize = isTouchDevice() ? '12px' : '18px';
            tierHeader.style.fontWeight = 'bold';
            tierHeader.style.color = tier.color;
            tierHeader.style.borderBottom = `1px solid ${tier.color}`;
            tierHeader.style.paddingBottom = '5px';
            tierHeader.style.marginBottom = '10px';
            tierSection.appendChild(tierHeader);

            // Create fish grid
            const fishGrid = document.createElement('div');
            fishGrid.style.display = 'grid';
            fishGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
            fishGrid.style.gap = '10px';

            // Add fish to grid
            tier.fishes.forEach(fish => {
                const fishCard = document.createElement('div');
                fishCard.style.backgroundColor = 'rgba(50, 70, 110, 0.7)';
                fishCard.style.borderRadius = '5px';
                fishCard.style.padding = '10px';
                fishCard.style.display = 'flex';
                fishCard.style.flexDirection = 'column';
                fishCard.style.alignItems = 'center';
                fishCard.style.border = `1px solid ${tier.color}`;

                // Fish icon (colored rectangle for now, could be replaced with images)
                const fishIcon = document.createElement('div');
                fishIcon.style.width = '50px';
                fishIcon.style.height = '30px';
                fishIcon.style.backgroundColor = fish.color ? `#${fish.color.toString(16).padStart(6, '0')}` : tier.color;
                fishIcon.style.borderRadius = '3px';
                fishIcon.style.marginBottom = '8px';
                fishCard.appendChild(fishIcon);

                // Fish name
                const fishName = document.createElement('div');
                fishName.textContent = fish.name;
                fishName.style.fontWeight = 'bold';
                fishName.style.marginBottom = '5px';
                fishName.style.textAlign = 'center';
                fishCard.appendChild(fishName);

                // Fish count
                const fishCount = document.createElement('div');
                fishCount.textContent = `Count: ${fish.count}`;
                fishCount.style.fontSize = isTouchDevice() ? '10px' : '12px';
                fishCard.appendChild(fishCount);

                // Fish value
                const fishValue = document.createElement('div');
                fishValue.textContent = `Value: ${fish.value}`;
                fishValue.style.fontSize = isTouchDevice() ? '10px' : '12px';
                fishCard.appendChild(fishValue);

                fishGrid.appendChild(fishCard);
            });

            tierSection.appendChild(fishGrid);
            fishContent.appendChild(tierSection);
        });
    }

    // Update treasure inventory display
    updateTreasureInventory(treasureInventory) {
        const treasureContent = this.elements.treasureContent;
        if (!treasureContent) return;

        // Clear existing content
        treasureContent.innerHTML = '';

        // Check for proper data format
        if (!treasureInventory || (Array.isArray(treasureInventory) && treasureInventory.length === 0) ||
            (typeof treasureInventory === 'object' && Object.keys(treasureInventory).length === 0)) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = 'No treasures found yet. Defeat sea monsters to collect treasures!';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.color = 'rgba(200, 200, 200, 0.7)';
            treasureContent.appendChild(emptyMessage);
            return;
        }

        // Process the treasure data into a standardized format
        let processedTreasures = {};

        if (Array.isArray(treasureInventory)) {
            // Server format: array of treasure objects
            treasureInventory.forEach(treasure => {
                const treasureName = treasure.name || 'Unknown Treasure';
                if (!processedTreasures[treasureName]) {
                    processedTreasures[treasureName] = {
                        name: treasureName,
                        count: 1,
                        value: treasure.data?.value || 5,
                        color: treasure.data?.color || 0xFFD700,
                        description: treasure.data?.description || ''
                    };
                } else {
                    processedTreasures[treasureName].count += 1;
                }
            });
        } else {
            // Handle existing object format
            processedTreasures = treasureInventory;
        }

        // Create treasure grid
        const treasureGrid = document.createElement('div');
        treasureGrid.style.display = 'grid';
        treasureGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
        treasureGrid.style.gap = '15px';
        treasureGrid.style.padding = '10px';

        // Add each treasure to the grid
        for (const [treasureName, treasureData] of Object.entries(processedTreasures)) {
            const treasureCard = document.createElement('div');
            treasureCard.style.backgroundColor = 'rgba(50, 70, 110, 0.7)';
            treasureCard.style.borderRadius = '5px';
            treasureCard.style.padding = '12px';
            treasureCard.style.display = 'flex';
            treasureCard.style.flexDirection = 'column';
            treasureCard.style.alignItems = 'center';
            treasureCard.style.border = `1px solid rgba(200, 170, 100, 0.8)`;

            // Ensure color is defined with a default
            const treasureColor = treasureData.color !== undefined ?
                `#${treasureData.color.toString(16).padStart(6, '0')}` :
                '#FFD700';  // Default gold color

            // Treasure icon
            const treasureIcon = document.createElement('div');
            treasureIcon.style.width = '60px';
            treasureIcon.style.height = '60px';
            treasureIcon.style.backgroundColor = treasureColor;
            treasureIcon.style.borderRadius = '50%';
            treasureIcon.style.marginBottom = '10px';
            treasureIcon.style.boxShadow = '0 0 10px rgba(255, 255, 200, 0.5)';
            treasureCard.appendChild(treasureIcon);

            // Treasure name
            const nameElement = document.createElement('div');
            nameElement.textContent = treasureName;
            nameElement.style.fontWeight = 'bold';
            nameElement.style.marginBottom = '8px';
            nameElement.style.textAlign = 'center';
            nameElement.style.color = 'rgba(255, 220, 150, 1)';
            treasureCard.appendChild(nameElement);

            // Treasure count with safe default
            const countElement = document.createElement('div');
            countElement.textContent = `Count: ${treasureData.count || 1}`;
            countElement.style.fontSize = isTouchDevice() ? '10px' : '12px';
            countElement.style.marginBottom = '5px';
            treasureCard.appendChild(countElement);

            // Treasure value with safe default
            const valueElement = document.createElement('div');
            valueElement.textContent = `Value: ${treasureData.value || 5}`;
            valueElement.style.fontSize = isTouchDevice() ? '10px' : '12px';
            treasureCard.appendChild(valueElement);

            // Treasure description (if available)
            if (treasureData.description) {
                const descElement = document.createElement('div');
                descElement.textContent = treasureData.description;
                descElement.style.fontSize = isTouchDevice() ? '9px' : '11px';
                descElement.style.marginTop = '8px';
                descElement.style.color = 'rgba(200, 200, 200, 0.9)';
                descElement.style.fontStyle = 'italic';
                descElement.style.textAlign = 'center';
                treasureCard.appendChild(descElement);
            }

            treasureGrid.appendChild(treasureCard);
        }

        treasureContent.appendChild(treasureGrid);
    }

    // Play a simple, pleasant chest open sound
    playChestOpenSound() {
        // Create audio context if not already created
        if (!window.audioContext) {
            try {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {

                return;
            }
        }

        // Create a gentle "chip" sound
        const currentTime = window.audioContext.currentTime;

        // Simple oscillator for a pleasant tone
        const osc = window.audioContext.createOscillator();
        const gain = window.audioContext.createGain();

        // Use sine wave for a smooth sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, currentTime + 0.05);

        // Very short duration with quick fade
        gain.gain.setValueAtTime(0.1, currentTime); // Lower volume (0.1 instead of 0.6)
        gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.08);

        osc.connect(gain);
        gain.connect(window.audioContext.destination);

        // Start and stop - very brief sound
        osc.start(currentTime);
        osc.stop(currentTime + 0.08);
    }

    // Play a subtle chest close sound
    playChestCloseSound() {
        // Create audio context if not already created
        if (!window.audioContext) {
            try {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {

                return;
            }
        }

        // Create a gentle "chip" sound (slightly different than open)
        const currentTime = window.audioContext.currentTime;

        // Simple oscillator
        const osc = window.audioContext.createOscillator();
        const gain = window.audioContext.createGain();

        // Use sine wave for a clean sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, currentTime + 0.05);

        // Very short duration with quick fade
        gain.gain.setValueAtTime(0.08, currentTime); // Even lower volume
        gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.06);

        osc.connect(gain);
        gain.connect(window.audioContext.destination);

        // Start and stop - very brief sound
        osc.start(currentTime);
        osc.stop(currentTime + 0.06);
    }

    // Toggle inventory
    toggleInventory(open) {
        const inventoryPanel = this.elements.panel;
        if (!inventoryPanel) return;

        if (open) {
            // Play chest opening sound
            this.playChestOpenSound();

            inventoryPanel.style.display = 'flex';
            this.isOpen = true;
            // Register this as an open UI with the main game UI if available
            if (typeof this.registerOpenUI === 'function') {
                this.registerOpenUI('inventory');
            }
        } else {
            // Play chest closing sound (slightly different)
            this.playChestCloseSound();

            inventoryPanel.style.display = 'none';
            this.isOpen = false;
            // Unregister this as an open UI if available
            if (typeof this.unregisterOpenUI === 'function') {
                this.unregisterOpenUI('inventory');
            }
        }
    }
}

// Export the inventory UI class
export default InventoryUI; 