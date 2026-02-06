import { useEffect, useRef } from 'react';

/**
 * Hook pour piéger le focus dans un modal (focus trap)
 * Empêche le focus de sortir du modal et le restaure à la fermeture
 * 
 * @param {boolean} isOpen - État d'ouverture du modal
 * @returns {React.RefObject} - Ref à attacher au conteneur du modal
 */
export function useFocusTrap(isOpen) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        // Sauvegarder l'élément qui avait le focus
        previousFocusRef.current = document.activeElement;

        // Attendre que le modal soit rendu
        setTimeout(() => {
            if (containerRef.current) {
                // Déplacer le focus dans le modal
                const firstFocusable = containerRef.current.querySelector(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }
        }, 100);

        // Fonction pour piéger le focus
        const handleTabKey = (e) => {
            if (!containerRef.current) return;

            const focusableElements = containerRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);

        // Cleanup : restaurer le focus
        return () => {
            document.removeEventListener('keydown', handleTabKey);
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [isOpen]);

    return containerRef;
}
