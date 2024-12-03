export function logInfo(...info: unknown[]): void {
    console.info('[INFO]', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), ...info);
}

export function logError(...error: unknown[]): void {
    console.error('[ERROR]', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), ...error);
}

export function serialize<T>(data: T): string {
    return JSON.stringify(data);
}

export function deserialize<T>(data: string): T {
    return JSON.parse(data);
}
