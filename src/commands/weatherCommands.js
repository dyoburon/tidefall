import { startRain, stopRain, initRain } from '../weather/rain.js';
import { boat } from '../core/gameState.js';

// Define the weather commands
export const weatherCommands = [
    {
        name: 'rain',
        description: 'Control rain weather. Usage: /rain [start|stop|intensity (1-10)]',
        handler: (args, chatSystem) => {
            // Get current boat position for rain center
            const playerPosition = boat.position.clone();

            // Track rain state within the command handler
            // We'll check if rain is active by looking at the rain module
            const rainSystem = initRain();

            // No arguments - toggle rain
            if (args.length === 0) {
                if (rainSystem.isActive()) {
                    stopRain();
                    chatSystem.addSystemMessage('Rain stopped.');
                } else {
                    startRain(playerPosition);
                    chatSystem.addSystemMessage('Rain started with default intensity.');
                }
                return;
            }

            // Process subcommands
            const subcommand = args[0].toLowerCase();

            switch (subcommand) {
                case 'start':
                    // Optional intensity parameter
                    let intensity = args.length > 1 ? parseInt(args[1]) : 5;
                    intensity = Math.max(1, Math.min(10, intensity)); // Clamp between 1-10

                    // Calculate rain parameters based on intensity
                    const rainParams = {
                        count: 100 + (intensity * 50), // 150-600 particles
                        windStrength: 0.02 + (intensity * 0.01) // 0.03-0.12 wind strength
                    };

                    startRain(playerPosition, rainParams);
                    chatSystem.addSystemMessage(`Rain started with intensity level ${intensity}.`);
                    break;

                case 'stop':
                    stopRain();
                    chatSystem.addSystemMessage('Rain stopped.');
                    break;

                case 'heavy':
                    startRain(playerPosition, { count: 600, windStrength: 0.1 });
                    chatSystem.addSystemMessage('Heavy rain started.');
                    break;

                case 'light':
                    startRain(playerPosition, { count: 150, windStrength: 0.03 });
                    chatSystem.addSystemMessage('Light rain started.');
                    break;

                default:
                    // Try to parse as intensity number
                    const intensityValue = parseInt(subcommand);
                    if (!isNaN(intensityValue)) {
                        const level = Math.max(1, Math.min(10, intensityValue)); // Clamp between 1-10
                        const rainParams = {
                            count: 100 + (level * 50),
                            windStrength: 0.02 + (level * 0.01)
                        };

                        startRain(playerPosition, rainParams);
                        chatSystem.addSystemMessage(`Rain started with intensity level ${level}.`);
                    } else {
                        chatSystem.addSystemMessage('Unknown rain command. Usage: /rain [start|stop|intensity (1-10)|light|heavy]');
                    }
                    break;
            }
        }
    }
    // Future weather commands can be added here
]; 