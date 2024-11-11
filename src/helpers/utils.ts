export function logerror(error: unknown): void {
    console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error);
}

export function serialize<T>(data: T): string {
    return JSON.stringify(data);
}

export function deserialize<T>(data: string): T {
    return JSON.parse(data);
}
