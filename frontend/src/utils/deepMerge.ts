// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge<T>(target: T, source: any): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(output[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

export default deepMerge;
