import { setPlayerName, getPlayerName } from '../core/network.js';

/**
 * Sanitize a player name to prevent XSS and ensure valid formatting
 * @param {string} name - The raw name input
 * @returns {string} - The sanitized name
 */
function sanitizePlayerName(name) {
    if (!name) return '';



    // Step 1: Remove HTML tags and special characters that could be used for script injection
    let sanitized = name
        .replace(/</g, '') // Remove < to prevent HTML tags
        .replace(/>/g, '') // Remove > to prevent HTML tags
        .replace(/&/g, '') // Remove & to prevent HTML entities
        .replace(/"/g, '') // Remove double quotes
        .replace(/'/g, '') // Remove single quotes
        .replace(/\\/g, '') // Remove backslashes
        .replace(/\//g, '') // Remove forward slashes
        .replace(/\[/g, '') // Remove square brackets (clan tags only)
        .replace(/\]/g, ''); // Remove square brackets (clan tags only)

    // Step 2: Trim whitespace and limit length
    sanitized = sanitized.trim();

    // Step 3: Ensure a minimum length after sanitization
    if (sanitized.length < 2) {

        return '';
    }

    // Step 4: Limit maximum length
    if (sanitized.length > 20) {
        sanitized = sanitized.substring(0, 20);

    }


    return sanitized;
}

/**
 * Sanitize a clan name to prevent XSS and ensure valid formatting
 * @param {string} clanName - The raw clan name input
 * @returns {string} - The sanitized clan name
 */
function sanitizeClanName(clanName) {
    if (!clanName) return '';



    // Step 1: Remove HTML tags and special characters that could be used for script injection
    let sanitized = clanName
        .replace(/</g, '') // Remove < to prevent HTML tags
        .replace(/>/g, '') // Remove > to prevent HTML tags
        .replace(/&/g, '') // Remove & to prevent HTML entities
        .replace(/"/g, '') // Remove double quotes
        .replace(/'/g, '') // Remove single quotes
        .replace(/\\/g, '') // Remove backslashes
        .replace(/\//g, '') // Remove forward slashes
        .replace(/\[/g, '') // Remove square brackets (since we add these ourselves)
        .replace(/\]/g, ''); // Remove square brackets (since we add these ourselves)

    // Step 2: Trim whitespace and limit length
    sanitized = sanitized.trim();

    // Step 3: Ensure a minimum length after sanitization
    if (sanitized.length < 2) {

        return '';
    }

    // Step 4: Limit maximum length
    if (sanitized.length > 15) {
        sanitized = sanitized.substring(0, 15);

    }


    return sanitized;
}

/**
 * Extract the clan tag from a player name if present
 * @param {string} playerName - The full player name
 * @returns {string|null} - The clan tag with brackets or null if not found
 */
function extractClanTag(playerName) {
    if (!playerName) return null;

    // Check if name has clan tag format: [ClanName] PlayerName
    if (playerName.includes('[') && playerName.includes(']')) {
        const matches = playerName.match(/^(\[.*?\])/);
        if (matches && matches[1]) {
            return matches[1]; // Return just the clan tag with brackets
        }
    }

    return null; // No clan tag found
}

/**
 * Extract the base player name without clan tag
 * @param {string} playerName - The full player name
 * @returns {string} - The player name without the clan tag
 */
function extractBaseName(playerName) {
    if (!playerName) return '';

    // Check if player already has a clan tag
    if (playerName.includes('[') && playerName.includes(']')) {
        // Match everything after the last closing bracket
        const matches = playerName.match(/\](.*?)$/);

        if (matches && matches[1] && matches[1].trim().length > 0) {
            // Return the name part after the clan tag
            return matches[1].trim();
        }
    }

    // If no clan tag or couldn't extract, return the original name
    return playerName;
}

/**
 * Clan command implementation
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
export function clanCommand(args, chatSystem) {

    // Check if any arguments were provided
    if (args.length === 0) {
        showClanCommandHelp(chatSystem);
        return;
    }

    const subcommand = args[0].toLowerCase();


    // Handle different clan subcommands
    switch (subcommand) {
        case 'create':
            handleClanCreate(args.slice(1), chatSystem);
            break;
        case 'help':
            showClanCommandHelp(chatSystem);
            break;
        default:
            chatSystem.addSystemMessage(`Unknown clan subcommand: ${subcommand}. Type "/clan help" for available commands.`);
            break;
    }
}

/**
 * Handle the clan create subcommand
 * @param {Array<string>} args - Command arguments after "create"
 * @param {object} chatSystem - Reference to the chat system
 */
function handleClanCreate(args, chatSystem) {


    // Check if a clan name was provided
    if (args.length === 0) {
        chatSystem.addSystemMessage('Please provide a clan name: /clan create [name]');
        return;
    }

    // Join all remaining arguments to form the clan name
    const rawClanName = args.join(' ').trim();


    // Sanitize the clan name to prevent XSS and ensure valid formatting
    const clanName = sanitizeClanName(rawClanName);

    // Validate sanitized clan name
    if (!clanName || clanName.length < 2) {
        chatSystem.addSystemMessage('Invalid clan name. Please use at least 2 alphanumeric characters and avoid special characters.');
        return;
    }

    // Get the current player name from the network module
    let currentPlayerName = getPlayerName();


    // Get the player's base name (without any existing clan tags)
    let baseName = currentPlayerName;

    // Check if the player already has a clan tag
    if (currentPlayerName.includes('[') && currentPlayerName.includes(']')) {


        // Match everything after the last closing bracket
        // This handles cases like "[OldClan] PlayerName" or just "[OldClan]"
        const matches = currentPlayerName.match(/\](.*?)$/);


        if (matches && matches[1] && matches[1].trim().length > 0) {
            // We found text after the closing bracket - this is the actual player name
            baseName = matches[1].trim();

        } else {
            // If we're here, the name is probably just "[Something]"
            // We need to check if we have an original name stored in Firestore
            // For now, just use a default name
            baseName = "Sailor_" + Math.floor(Math.random() * 1000);

        }
    }

    // Final safety check - ensure we have a valid name
    if (!baseName || baseName.length === 0) {
        baseName = "Sailor_" + Math.floor(Math.random() * 1000);

    }

    // Format the new player name with clan tag at the beginning
    const newPlayerName = `[${clanName}] ${baseName}`;


    // Update the player name

    setPlayerName(newPlayerName);

    chatSystem.addSystemMessage(`You've created and joined clan "${clanName}". Your new display name is "${newPlayerName}".`);
}

/**
 * Show help for the clan command
 * @param {object} chatSystem - Reference to the chat system
 */
function showClanCommandHelp(chatSystem) {
    chatSystem.addSystemMessage(`
        Clan Commands:
        /clan create [name] - Create a new clan and add its tag to your name
        /clan help - Show this help message
    `);
}

/**
 * Nickname command implementation - Allows changing your display name while preserving clan tag
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
export function nickCommand(args, chatSystem) {


    // Check if a new nickname was provided
    if (args.length === 0) {
        chatSystem.addSystemMessage('Please provide a new nickname: /nick [new name]');
        return;
    }

    // Join all arguments to form the new nickname
    const rawNickname = args.join(' ').trim();


    // Sanitize the nickname to prevent XSS and ensure valid formatting
    const newNickname = sanitizePlayerName(rawNickname);

    // Validate sanitized nickname
    if (!newNickname || newNickname.length < 2) {
        chatSystem.addSystemMessage('Invalid nickname. Please use at least 2 alphanumeric characters and avoid special characters.');
        return;
    }

    // Get the current player name
    const currentPlayerName = getPlayerName();


    // Check for clan tag in the current name and preserve it
    const clanTag = extractClanTag(currentPlayerName);


    // Format the new player name, preserving clan tag if it exists
    let updatedPlayerName;
    if (clanTag) {
        updatedPlayerName = `${clanTag} ${newNickname}`;

    } else {
        updatedPlayerName = newNickname;

    }

    // Update the player's name
    setPlayerName(updatedPlayerName);

    // Notify the player of the change
    chatSystem.addSystemMessage(`Your nickname has been changed to "${updatedPlayerName}".`);
}

// Export a list of all commands in this module with their descriptions
export const clanCommands = [
    {
        name: 'clan',
        handler: clanCommand,
        description: 'Create and manage clans'
    },
    {
        name: 'nick',
        handler: nickCommand,
        description: 'Change your nickname while preserving clan tag'
    }
]; 