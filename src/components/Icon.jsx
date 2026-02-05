import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Composant Icon qui affiche une icône Lucide
 * @param {string} name - Nom de l'icône (ex: "Heart", "ChevronLeft")
 * @param {number} size - Taille de l'icône en pixels
 * @param {string} className - Classes CSS additionnelles
 */
export default function Icon({ name, size = 20, className = "" }) {
    const IconComponent = LucideIcons[name];

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in lucide-react`);
        return <span className="inline-block" style={{ width: size, height: size }} />;
    }

    return <IconComponent size={size} className={className} />;
}
