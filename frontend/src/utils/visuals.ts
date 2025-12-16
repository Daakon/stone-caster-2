/**
 * Visual Utilities
 */

const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Blue-Purple
    'linear-gradient(135deg, #2af598 0%, #009efd 100%)', // Green-Blue
    'linear-gradient(135deg, #b721ff 0%, #21d4fd 100%)', // Purple-Blue
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)', // Pink-Pastel
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-Red
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', // Mint-Blue
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Red-Yellow
    'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)', // Green
];

/**
 * Returns a deterministic gradient based on the given string ID.
 * The same ID will always return the same gradient.
 */
export function getDeterministicGradient(id: string): string {
    if (!id) return GRADIENTS[0];

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % GRADIENTS.length;
    return GRADIENTS[index];
}
