import { isTouchDevice } from '../controls/touchControls.js';

class MobileAbilityBar {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'mobile-ability-bar';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '20px';
        this.container.style.right = '40px';
        this.container.style.width = '80px';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.gap = '8px';
        this.container.style.pointerEvents = 'auto';
        this.container.style.zIndex = '1000';

        this.abilities = new Map();
        this.setupAbilities();
    }

    setupAbilities() {
        // Define the three main abilities we want to use
        const abilities = [
            {
                id: 'cannonShot',
                name: 'Cannon',
                icon: '💥',
                color: '#ff4444',
                key: 'q'
            },
            {
                id: 'sprint',
                name: 'Sprint',
                icon: '🏃',
                color: '#44ff44',
                key: 'shift'
            },
            {
                id: 'scatterShot',
                name: 'Scatter',
                icon: '🔫',
                color: '#4444ff',
                key: 't'
            }
        ];

        abilities.forEach(ability => {
            const button = this.createAbilityButton(ability);
            this.abilities.set(ability.id, {
                button,
                config: ability
            });
            this.container.appendChild(button);
        });
    }

    createAbilityButton(ability) {
        const button = document.createElement('div');
        button.className = 'mobile-ability-button';
        button.style.width = '40px';
        button.style.height = '40px';
        button.style.backgroundColor = ability.color;
        button.style.borderRadius = '50%';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontSize = '18px';
        button.style.color = 'white';
        button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        button.style.border = '2px solid rgba(255,255,255,0.4)';
        button.style.transition = 'transform 0.1s ease';
        button.innerHTML = ability.icon;

        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.9)';
            this.triggerAbility(ability.id, ability.key);
        });

        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(1)';
        });

        const cooldownOverlay = document.createElement('div');
        cooldownOverlay.className = 'cooldown-overlay';
        cooldownOverlay.style.position = 'absolute';
        cooldownOverlay.style.width = '100%';
        cooldownOverlay.style.height = '100%';
        cooldownOverlay.style.borderRadius = '50%';
        cooldownOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        cooldownOverlay.style.display = 'none';
        button.appendChild(cooldownOverlay);

        return button;
    }

    triggerAbility(abilityId, key) {
        // Get the global ability manager instance
        const abilityManager = window.abilityManager;
        if (!abilityManager) {
            console.warn('Ability Manager not found');
            return;
        }

        // Use the activateAbilityByKey method from the ability manager
        abilityManager.activateAbilityByKey(key);
    }

    startCooldown(abilityId, duration) {
        const ability = this.abilities.get(abilityId);
        if (!ability) return;

        const button = ability.button;
        const overlay = button.querySelector('.cooldown-overlay');
        if (!overlay) return;

        overlay.style.display = 'block';
        overlay.style.transition = `height ${duration}ms linear`;
        overlay.style.height = '0%';

        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.height = '100%';
            overlay.style.transition = 'none';
        }, duration);
    }

    mount() {
        if (isTouchDevice()) {
            document.body.appendChild(this.container);
        }
    }

    unmount() {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default MobileAbilityBar; 