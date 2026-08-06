module.exports = {
    /**
     * Builds a URL-safe slug from a title, appending -1, -2, ... until it is unique
     * within `tableName`.
     */
    slugGenerator: async (title, fieldName, tableName) => {
        const source = title || 'Property listing';
        const slug = source
            .trim()
            .toLowerCase()
            .split(' ')
            .join('-')
            .replace(/[,"$!^@%*&]+/g, '');

        const table = require(`../models/${tableName}`);
        if (!table) return String(Date.now());

        let incrementer = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const candidate = incrementer ? `${slug}-${incrementer}` : slug;
            const existing = await table.findOne({ slug: candidate }).select('slug');

            if (existing && existing.slug) incrementer++;
            else return candidate;
        }
    },

    /**
     * Returns the first key in `requiredArray` missing from `data`, or false if all
     * are present.
     */
    isKeyMissing: (data = {}, requiredArray = []) => {
        // `for (element of ...)` in the original declared an implicit global.
        for (const element of requiredArray) {
            if (!data[element]) return element;
        }
        return false;
    },
};
