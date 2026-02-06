import { useEffect, useRef } from 'react';

/**
 * Hook pour gérer les raccourcis clavier
 * 
 * @param {string} key - Touche à écouter (ex: 'Escape', 'Enter')
 * @param {Function} callback - Fonction à exécuter quand la touche est pressée
 * @param {boolean} enabled - Si false, le hook ne fait rien
 */
export function useKeyboardShortcut(key, callback, enabled = true) {
    const callbackRef = useRef(callback);

    // Mettre à jour la ref quand le callback change
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event) => {
            if (event.key === key) {
                callbackRef.current(event);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [key, enabled]); // callback n'est plus dans les dépendances
}
