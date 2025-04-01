/**
 * Global debug settings
 */
const DEBUG_CONFIG = {
    debugLevel: 2, // 0=none, 1=minimal, 2=verbose
    enabledModules: {
        all: true,
        npc: true,
        combat: true,
        physics: true,
        ai: true
    }
};

/**
 * Debug log helper function with level control
 * @param {string} message - The message to log
 * @param {number} level - The debug level (higher means more verbose)
 * @param {string} module - Optional module name for filtering
 */
export function debugLog(message, level = 1, module = 'all') {
    return;
    if (level <= DEBUG_CONFIG.debugLevel) {
        if (DEBUG_CONFIG.enabledModules.all || DEBUG_CONFIG.enabledModules[module]) {
            const prefix = module !== 'all' ? `[${module}] ` : '';

        }
    }
}

/**
 * Set debug level
 * @param {number} level - Debug level (0=none, 1=minimal, 2=verbose)
 */
export function setDebugLevel(level) {
    DEBUG_CONFIG.debugLevel = level;
    debugLog(`Debug level set to ${level}`, 0); // Always show this message
}

/**
 * Enable or disable debug for a specific module
 * @param {string} moduleName - The module name to enable/disable
 * @param {boolean} enabled - Whether to enable debug for this module
 */
export function setModuleDebug(moduleName, enabled) {
    if (moduleName === 'all') {
        // Enable/disable all modules
        for (const key in DEBUG_CONFIG.enabledModules) {
            DEBUG_CONFIG.enabledModules[key] = enabled;
        }
    } else {
        // Enable/disable specific module
        DEBUG_CONFIG.enabledModules[moduleName] = enabled;
    }

    debugLog(`Debug for module '${moduleName}' ${enabled ? 'enabled' : 'disabled'}`, 0);
} 