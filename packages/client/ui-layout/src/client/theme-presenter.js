/** Body attribute selecting the dark base palette in the token stylesheets. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme';
/** Applies theme snapshots to the document; one instance per plugin fiber. */
export class ThemePresenter {
    /** Token names this presenter wrote in the last apply (its retraction set). */
    appliedTokens = [];
    /** The single metadata node this presenter inserts and removes. */
    themeColorMeta;
    /** Create the presenter-owned metadata node or take over the existing one before the first snapshot arrives. */
    constructor() {
        const existing = document.querySelector('meta[name="theme-color"]');
        if (existing && existing instanceof HTMLMetaElement) {
            this.themeColorMeta = existing;
        }
        else {
            this.themeColorMeta = document.createElement('meta');
            this.themeColorMeta.name = 'theme-color';
        }
    }
    /**
     * Project a snapshot onto the document: set root `color-scheme` and the body
     * palette attribute from `active.colorScheme` (never the id — `system` is
     * resolved upstream), then replace the previously applied token variables
     * with `active.tokens`. Browser theme-color metadata follows the computed
     * body background after those writes, so the rendered palette remains the
     * color authority.
     * @param snapshot - resolved theme snapshot from ctx.theme.
     */
    apply(snapshot) {
        const scheme = snapshot.active.colorScheme;
        document.documentElement.style.colorScheme = scheme;
        const body = document.body;
        if (scheme === 'dark')
            body.setAttribute(DARK_ATTRIBUTE, '');
        else
            body.removeAttribute(DARK_ATTRIBUTE);
        for (const name of this.appliedTokens)
            body.style.removeProperty(name);
        this.appliedTokens = [];
        for (const [name, value] of Object.entries(snapshot.active.tokens)) {
            body.style.setProperty(name, value);
            this.appliedTokens.push(name);
        }
        // Defer the read to the next frame. This ensures that any CSS transitions
        // or repaints triggered by the token/attribute updates have started,
        // and iOS Safari reliably picks up the new theme-color.
        requestAnimationFrame(() => {
            this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
        });
        if (!this.themeColorMeta.isConnected)
            document.head.append(this.themeColorMeta);
    }
    /** Retract root color-scheme, the palette attribute, token variables, and the owned metadata node. */
    dispose() {
        document.documentElement.style.removeProperty('color-scheme');
        const body = document.body;
        body.removeAttribute(DARK_ATTRIBUTE);
        for (const name of this.appliedTokens)
            body.style.removeProperty(name);
        this.appliedTokens = [];
        this.themeColorMeta.remove();
    }
}
//# sourceMappingURL=theme-presenter.js.map