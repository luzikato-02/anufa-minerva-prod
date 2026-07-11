const { put, del } = require('@vercel/blob');

// Internal-only endpoint: called by the Python train/predict/delete functions
// (never by Laravel or the browser directly) since @vercel/blob is JS-only.
module.exports = async (req, res) => {
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!provided || provided !== process.env.ML_SERVICE_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, pathname, url, contentBase64 } = req.body || {};

    try {
        if (action === 'upload') {
            const blob = await put(pathname, Buffer.from(contentBase64, 'base64'), {
                access: 'public',
                addRandomSuffix: false,
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            return res.status(200).json({ url: blob.url });
        }

        if (action === 'download') {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            return res.status(200).json({ contentBase64: buffer.toString('base64') });
        }

        if (action === 'delete') {
            await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
