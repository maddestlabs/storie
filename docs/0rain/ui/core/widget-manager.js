/**
 * Widget Manager
 * Central registry and lifecycle manager for all widgets
 */
export class WidgetManager {
    widgets;
    groups;
    navigation;
    constructor() {
        this.widgets = new Map();
        this.groups = new Map();
        this.navigation = {
            focusedWidget: null,
            focusableWidgets: [],
            tabOrder: []
        };
    }
    normalizeGroupScale(scale) {
        const value = Number(scale);
        return Number.isFinite(value) && value > 0 ? value : 1;
    }
    normalizeGroupOpacity(opacity) {
        const value = Number(opacity);
        if (!Number.isFinite(value))
            return 1;
        return Math.max(0, Math.min(1, value));
    }
    createGroup(groupId) {
        return {
            id: groupId,
            visible: true,
            widgets: new Set(),
            transform: {
                x: 0,
                y: 0,
                scale: 1,
            },
            presentation: {
                opacity: 1,
            },
        };
    }
    ensureGroup(groupId) {
        let group = this.groups.get(groupId);
        if (!group) {
            group = this.createGroup(groupId);
            this.groups.set(groupId, group);
        }
        return group;
    }
    /**
     * Register a widget
     */
    register(widget) {
        this.widgets.set(widget.id, widget);
        // Add to group
        this.ensureGroup(widget.group).widgets.add(widget.id);
        // Update focusable list
        if (widget.focusable) {
            this.navigation.focusableWidgets.push(widget.id);
            this.navigation.tabOrder.push(widget.id);
        }
    }
    /**
     * Unregister a widget
     */
    unregister(id) {
        const widget = this.widgets.get(id);
        if (!widget)
            return;
        // Remove from group
        const group = this.groups.get(widget.group);
        if (group) {
            group.widgets.delete(id);
        }
        // Remove from navigation
        const focusIdx = this.navigation.focusableWidgets.indexOf(id);
        if (focusIdx !== -1) {
            this.navigation.focusableWidgets.splice(focusIdx, 1);
        }
        const tabIdx = this.navigation.tabOrder.indexOf(id);
        if (tabIdx !== -1) {
            this.navigation.tabOrder.splice(tabIdx, 1);
        }
        // Clear focus if this widget was focused
        if (this.navigation.focusedWidget === id) {
            this.navigation.focusedWidget = null;
        }
        this.widgets.delete(id);
    }
    /**
     * Get widget by ID
     */
    get(id) {
        return this.widgets.get(id);
    }
    /**
     * Get all widgets
     */
    getAll() {
        return Array.from(this.widgets.values());
    }
    /**
     * Get visible widgets (respecting group visibility)
     */
    getVisible() {
        return Array.from(this.widgets.values()).filter(widget => {
            if (!widget.state.visible)
                return false;
            const group = this.groups.get(widget.group);
            return group ? group.visible : true;
        });
    }
    /**
     * Set group visibility
     */
    setGroupVisible(groupId, visible) {
        this.ensureGroup(groupId).visible = visible;
    }
    setGroupOpacity(groupId, opacity) {
        this.ensureGroup(groupId).presentation.opacity = this.normalizeGroupOpacity(opacity);
    }
    setGroupTransform(groupId, transform) {
        const group = this.ensureGroup(groupId);
        if (transform.x !== undefined && Number.isFinite(Number(transform.x))) {
            group.transform.x = Number(transform.x);
        }
        if (transform.y !== undefined && Number.isFinite(Number(transform.y))) {
            group.transform.y = Number(transform.y);
        }
        if (transform.scale !== undefined) {
            group.transform.scale = this.normalizeGroupScale(transform.scale);
        }
    }
    getGroupState(groupId) {
        return this.ensureGroup(groupId);
    }
    getGroupTransform(groupId) {
        return { ...this.ensureGroup(groupId).transform };
    }
    getGroupPresentation(groupId) {
        return { ...this.ensureGroup(groupId).presentation };
    }
    /**
     * Check if group is visible
     */
    isGroupVisible(groupId) {
        const group = this.groups.get(groupId);
        return group ? group.visible : true;
    }
    /**
     * Focus a widget
     */
    focus(id) {
        // Blur current focused widget
        if (this.navigation.focusedWidget !== null) {
            const current = this.widgets.get(this.navigation.focusedWidget);
            if (current) {
                current.updateState(current.state.hovered, current.state.pressed, false);
            }
        }
        // Focus new widget
        this.navigation.focusedWidget = id;
        if (id !== null) {
            const widget = this.widgets.get(id);
            if (widget && widget.focusable) {
                widget.updateState(widget.state.hovered, widget.state.pressed, true);
            }
        }
    }
    /**
     * Focus next widget in tab order
     */
    focusNext() {
        if (this.navigation.tabOrder.length === 0)
            return;
        let currentIdx = -1;
        if (this.navigation.focusedWidget !== null) {
            currentIdx = this.navigation.tabOrder.indexOf(this.navigation.focusedWidget);
        }
        // Find next focusable, visible, enabled widget
        let nextIdx = (currentIdx + 1) % this.navigation.tabOrder.length;
        let attempts = 0;
        while (attempts < this.navigation.tabOrder.length) {
            const nextId = this.navigation.tabOrder[nextIdx];
            const widget = this.widgets.get(nextId);
            if (widget && widget.state.visible && widget.state.enabled && widget.focusable) {
                const group = this.groups.get(widget.group);
                if (!group || group.visible) {
                    this.focus(nextId);
                    return;
                }
            }
            nextIdx = (nextIdx + 1) % this.navigation.tabOrder.length;
            attempts++;
        }
    }
    /**
     * Focus previous widget in tab order
     */
    focusPrevious() {
        if (this.navigation.tabOrder.length === 0)
            return;
        let currentIdx = this.navigation.tabOrder.length - 1;
        if (this.navigation.focusedWidget !== null) {
            currentIdx = this.navigation.tabOrder.indexOf(this.navigation.focusedWidget);
        }
        // Find previous focusable, visible, enabled widget
        let prevIdx = (currentIdx - 1 + this.navigation.tabOrder.length) % this.navigation.tabOrder.length;
        let attempts = 0;
        while (attempts < this.navigation.tabOrder.length) {
            const prevId = this.navigation.tabOrder[prevIdx];
            const widget = this.widgets.get(prevId);
            if (widget && widget.state.visible && widget.state.enabled && widget.focusable) {
                const group = this.groups.get(widget.group);
                if (!group || group.visible) {
                    this.focus(prevId);
                    return;
                }
            }
            prevIdx = (prevIdx - 1 + this.navigation.tabOrder.length) % this.navigation.tabOrder.length;
            attempts++;
        }
    }
    /**
     * Get currently focused widget
     */
    getFocused() {
        if (this.navigation.focusedWidget === null)
            return null;
        return this.widgets.get(this.navigation.focusedWidget) || null;
    }
    /**
     * Clear all widgets
     */
    clear() {
        this.widgets.clear();
        this.groups.clear();
        this.navigation.focusedWidget = null;
        this.navigation.focusableWidgets = [];
        this.navigation.tabOrder = [];
    }
}
//# sourceMappingURL=widget-manager.js.map