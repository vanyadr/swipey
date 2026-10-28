import data from './data.json';
export type Movie = {id: string; title: string; year: number; genre: string; poster: string};
export const movies: Movie[] = data;
export const movieIds = new Set(movies.map((m) => m.id));
export type Vote = {id: string; liked: boolean};
export type Session = {
    v: 1;
    dataset: 'movies-v1';
    name: string;
    order: string[];
    votes: Vote[];
    first?: {name: string; likes: string[]};
    role: 1 | 2;
};
const KEY = 'swipey:session:v1';
export const getName = () => {
    try {
        return localStorage.getItem('swipey:name') || '';
    } catch {
        return '';
    }
};
export const setName = (name: string) => localStorage.setItem('swipey:name', name);
export const shuffle = <T>(values: T[]): T[] => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};
export const freshSession = (name: string, first?: Session['first']): Session => ({
    v: 1,
    dataset: 'movies-v1',
    name,
    order: shuffle([...movieIds]),
    votes: [],
    first,
    role: first ? 2 : 1,
});
export const validateSession = (raw: unknown): raw is Session => {
    if (!raw || typeof raw !== 'object') return false;
    const s = raw as Partial<Session>;
    return (
        s.v === 1 &&
        s.dataset === 'movies-v1' &&
        typeof s.name === 'string' &&
        s.name.trim().length > 0 &&
        s.name.length <= 40 &&
        (s.role === 1 || s.role === 2) &&
        Array.isArray(s.order) &&
        s.order.length === movieIds.size &&
        new Set(s.order).size === movieIds.size &&
        s.order.every((id) => movieIds.has(id)) &&
        Array.isArray(s.votes) &&
        s.votes.length <= s.order.length &&
        s.votes.every((v, i) => v && movieIds.has(v.id) && typeof v.liked === 'boolean' && s.order?.[i] === v.id) &&
        (!s.first ||
            (typeof s.first.name === 'string' &&
                s.first.name.length <= 40 &&
                Array.isArray(s.first.likes) &&
                s.first.likes.every((id) => movieIds.has(id))))
    );
};
export const saveSession = (s: Session) => {
    localStorage.setItem(KEY, JSON.stringify(s));
};
export const readSession = (): Session | null => {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
        return validateSession(raw) ? raw : null;
    } catch {
        return null;
    }
};
export const clearSession = () => localStorage.removeItem(KEY);
export type Invitation = {v: 1; dataset: 'movies-v1'; name: string; likes: string[]};
export const createInvitation = (s: Session): Invitation => ({
    v: 1,
    dataset: 'movies-v1',
    name: s.name,
    likes: s.votes.filter((v) => v.liked).map((v) => v.id),
});
export const encodeInvitation = (inv: Invitation) => {
    const bytes = new TextEncoder().encode(JSON.stringify(inv));
    let binary = '';
    bytes.forEach((x) => (binary += String.fromCharCode(x)));
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};
export const decodeInvitation = (encoded: string): Invitation | null => {
    try {
        if (encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
        const base = encoded.replaceAll('-', '+').replaceAll('_', '/');
        const bytes = Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
        const x = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as Invitation;
        if (
            x.v !== 1 ||
            x.dataset !== 'movies-v1' ||
            typeof x.name !== 'string' ||
            !x.name.trim() ||
            x.name.length > 40 ||
            !Array.isArray(x.likes) ||
            x.likes.length > 15 ||
            new Set(x.likes).size !== x.likes.length ||
            !x.likes.every((id: unknown) => typeof id === 'string' && movieIds.has(id))
        )
            return null;
        return x;
    } catch {
        return null;
    }
};
export const matches = (first: string[], second: string[]) => second.filter((id) => first.includes(id));
