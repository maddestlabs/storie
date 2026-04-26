export function sectionTreeToCompileNodes(sections) {
    return sections.map((section) => ({
        id: String(section.id ?? `${section.title}-${section.startLine}`),
        title: section.title,
        level: section.level,
        startLine: section.startLine,
        endLine: section.endLine,
        children: sectionTreeToCompileNodes(section.children),
    }));
}
//# sourceMappingURL=ir.js.map