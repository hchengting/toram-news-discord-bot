const categories = {
    other: '商城',
    event: '活動',
    update: '更新',
    maintenance: '維修',
    important: '重要',
    defect: 'BUG',
} as const;

export type Category = (typeof categories)[keyof typeof categories];

export const categoriesOptions = [
    { label: categories.other, value: categories.other, description: '造型裝備、露珠道具、露珠增值等相關內容' },
    { label: categories.event, value: categories.event, description: '加速機、限時活動、官方直播、社群活動等相關內容' },
    { label: categories.update, value: categories.update, description: '遊戲內容更新、版本更新、劇情更新、地圖更新等相關內容' },
    { label: categories.maintenance, value: categories.maintenance, description: '伺服器維修、緊急維修等相關內容' },
    { label: categories.important, value: categories.important, description: '違規件數、客戶服務、執行環境變更、重要通知等相關內容' },
    { label: categories.defect, value: categories.defect, description: '遊戲內容錯誤、系統錯誤、操作錯誤等相關內容' },
];

function isCategoriesKey(key: string | undefined): key is keyof typeof categories {
    return key !== undefined && key in categories;
}

export function extractCategory(thumbnail: string | undefined): Category {
    const key = thumbnail?.match(/(?<=icon_news_)\w+(?=\.png)/)?.[0];
    return isCategoriesKey(key) ? categories[key] : categories.other;
}

export function sortCategories(values: Category[]): Category[] {
    const order = Object.values(categories);
    return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
