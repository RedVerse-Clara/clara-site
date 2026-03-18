/**
 * Instagram Graph API — publication logic
 * Used by the Vite dev server plugin to post images to Instagram.
 *
 * IMPORTANT: Content Publishing uses graph.facebook.com (NOT graph.instagram.com)
 * and parameters must be sent as form-urlencoded (NOT JSON).
 *
 * Flow:
 * 1. Create a media container (image_url + caption)
 * 2. Wait for the container to be ready
 * 3. Publish the container
 */

const FB_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Publish a single image post to Instagram.
 * @param {{ imageUrl: string, caption: string }} payload
 * @param {{ accessToken: string, igUserId: string }} credentials
 * @returns {Promise<{ id: string, permalink: string }>}
 */
export async function publishToInstagram({ imageUrl, caption }, { accessToken, igUserId }) {
    // Step 1 — Create the media container
    const params = new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
    });

    const containerRes = await fetch(`${FB_API_BASE}/${igUserId}/media`, {
        method: 'POST',
        body: params,
    });

    const containerData = await containerRes.json();

    if (containerData.error) {
        throw new Error(`Instagram container creation failed: ${containerData.error.message}`);
    }

    const creationId = containerData.id;

    // Step 2 — Poll until the container is ready (max 30s)
    await waitForContainerReady(creationId, accessToken);

    // Step 3 — Publish
    const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
    });

    const publishRes = await fetch(`${FB_API_BASE}/${igUserId}/media_publish`, {
        method: 'POST',
        body: publishParams,
    });

    const publishData = await publishRes.json();

    if (publishData.error) {
        throw new Error(`Instagram publish failed: ${publishData.error.message}`);
    }

    const mediaId = publishData.id;

    // Step 4 — Get the permalink
    const mediaRes = await fetch(`${FB_API_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`);
    const mediaData = await mediaRes.json();

    return { id: mediaId, permalink: mediaData.permalink || null };
}

/**
 * Poll the container status until it's FINISHED or timeout.
 */
async function waitForContainerReady(containerId, accessToken, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const res = await fetch(
            `${FB_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
        );
        const data = await res.json();

        if (data.status_code === 'FINISHED') return;
        if (data.status_code === 'ERROR') {
            throw new Error(`Instagram container error: ${data.status || 'unknown'}`);
        }

        // Wait 2s before next poll
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Instagram container timed out after 30s');
}

/**
 * Check if the access token is still valid and return its expiry info.
 * @returns {Promise<{ isValid: boolean, expiresAt: number | null }>}
 */
export async function checkTokenStatus(accessToken) {
    try {
        const res = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        );
        const data = await res.json();
        if (data.data) {
            return {
                isValid: data.data.is_valid,
                expiresAt: data.data.expires_at ? data.data.expires_at * 1000 : null,
            };
        }
        return { isValid: false, expiresAt: null };
    } catch {
        return { isValid: false, expiresAt: null };
    }
}
