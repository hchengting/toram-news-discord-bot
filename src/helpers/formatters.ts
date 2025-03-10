// @ts-types="npm:@types/html-to-text"
import type { DomNode, FormatCallback } from 'html-to-text';

const formatters: Record<string, FormatCallback> = {
    formatAnchor: (elem, walk, builder) => {
        const href = elem.attribs?.href || '';
        const texts = elem.children?.filter((child) => child.type === 'text') || [];
        const isTextUrl = texts[0]?.data?.startsWith('http');

        if (href && texts.length === 1 && !isTextUrl) {
            builder.startNoWrap();
            builder.addLiteral(`[`);
            walk(elem.children, builder);
            builder.addLiteral(`](`);
            builder.addInline(href, { noWordTransform: true });
            builder.addLiteral(`)`);
            builder.stopNoWrap();
        } else {
            walk(elem.children, builder);
            if (!isTextUrl) builder.addInline(href, { noWordTransform: true });
        }
    },
    formatTable: (elem, walk, builder) => {
        builder.openTable();
        elem.children.forEach(walkTable);
        builder.closeTable({ tableToString: (rows) => rows.map((row) => row.map((cell) => cell.text).join(' | ')).join('\n') });

        function walkTable(elem: DomNode) {
            if (elem.type !== 'tag') return;

            switch (elem.name) {
                case 'thead':
                case 'tbody':
                case 'tfoot':
                case 'center':
                    elem.children.forEach(walkTable);
                    break;
                case 'tr':
                    builder.openTableRow();
                    for (const cell of elem.children) {
                        if (cell.name === 'th' || cell.name === 'td') {
                            builder.openTableCell();
                            walk(cell.children, builder);
                            builder.closeTableCell();
                        }
                    }
                    builder.closeTableRow();
                    break;
            }
        }
    },
};

export default formatters;
