// colors objesini kullanan helper functions

const { colors } = require('../config/constants');

class ColorUtils {
    // Helper methods for colored console output
    static green(text) {
        return `${colors.GREEN}${text}${colors.NC}`;
    }

    static yellow(text) {
        return `${colors.YELLOW}${text}${colors.NC}`;
    }

    static red(text) {
        return `${colors.RED}${text}${colors.NC}`;
    }

    static cyan(text) {
        return `${colors.CYAN}${text}${colors.NC}`;
    }

    static blue(text) {
        return `${colors.BLUE}${text}${colors.NC}`;
    }

    static magenta(text) {
        return `${colors.MAGENTA}${text}${colors.NC}`;
    }

    static bright(text) {
        return `${colors.BRIGHT}${text}${colors.NC}`;
    }

    static dim(text) {
        return `${colors.DIM}${text}${colors.NC}`;
    }

    // Direct access to colors object
    static get colors() {
        return colors;
    }
}

module.exports = ColorUtils;