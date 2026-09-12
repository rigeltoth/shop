import { readFileSync, writeFileSync } from 'fs';

// Agrega botón '+' junto al input de Valores de Opción en el modal 'Agregar grupo de opciones', para no depender solo de Enter (mejora de UX, no cambia la lógica de agregado — usa el mismo handleAddValue existente).

const PATCHES = [
    {
        file: 'node_modules/@vendure/dashboard/src/app/routes/_authenticated/_products/components/option-value-input.tsx',
        replacements: [
            {
                target: `import { X } from 'lucide-react';`,
                replacement: `import { Plus, X } from 'lucide-react';`,
            },
            {
                target: `                <Input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter value and press Enter"
                    disabled={disabled}
                    className="flex-1"
                />
            </div>`,
                replacement: `                <Input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter value and press Enter"
                    disabled={disabled}
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddValue}
                    disabled={disabled || !newValue.trim()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>`,
            },
        ],
    },
];

let applied = 0;
let skipped = 0;
for (const { file, replacements } of PATCHES) {
    let content;
    try {
        content = readFileSync(file, 'utf-8');
    } catch {
        console.warn(`skipping missing file: ${file}`);
        continue;
    }
    let changed = false;
    for (const { target, replacement } of replacements) {
        if (content.includes(replacement)) {
            skipped++;
        } else if (content.includes(target)) {
            content = content.replace(target, replacement);
            changed = true;
            applied++;
        } else {
            console.warn(`[patch-option-value-input] WARNING: target not found in ${file} — dashboard version may have changed`);
        }
    }
    if (changed) {
        writeFileSync(file, content);
        console.log(`patched ${file}`);
    }
}
console.log(`[patch-option-value-input] done (${applied} applied, ${skipped} already present)`);
