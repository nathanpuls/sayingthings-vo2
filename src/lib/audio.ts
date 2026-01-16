export const getPlayableUrl = (url: string) => {
    if (!url) return "";

    // Google Drive
    const driveMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
    if (driveMatch && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
        return `https://docs.google.com/uc?id=${driveMatch[1]}`;
    }

    // Dropbox
    if (url.includes("dropbox.com") && url.includes("dl=0")) {
        return url.replace("dl=0", "raw=1");
    }

    // Base64
    if (url.startsWith('data:audio')) return url;

    // Firebase / Supabase / Direct
    return url;
};
export const parseSegments = (segments: any) => {
    if (!segments) return [];
    if (Array.isArray(segments)) return segments;
    if (typeof segments === 'string') {
        try {
            return JSON.parse(segments);
        } catch (e) {
            console.error("Failed to parse segments", e);
            return [];
        }
    }
    return [];
};

export const normalizeClips = (segments: any) => {
    const parsed = parseSegments(segments);
    if (parsed.length === 0) return [];

    return parsed.map((seg: any, index: number) => {
        const startTime = Number(seg.startTime) || Number(seg.start) || 0;
        // End time is the start of the next clip, or a large number for the last clip
        const endTime = index < parsed.length - 1
            ? Number(parsed[index + 1].startTime) || Number(parsed[index + 1].start) || startTime + 10
            : 999999;

        return {
            name: seg.label || seg.name || 'Untitled Clip',
            start: startTime,
            end: endTime
        };
    });
};
