import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, useLocation, useNavigate} from 'react-router-dom';
import {motion, useMotionValue, useTransform, animate} from 'motion/react';
import {QRCodeSVG} from 'qrcode.react';
import {BrowserQRCodeReader} from '@zxing/browser';
import {Check, Heart, HeartCrack, RotateCcw, ScanLine, Share2, UserRound, Copy} from 'lucide-react';
import {
    clearSession,
    createInvitation,
    decodeInvitation,
    encodeInvitation,
    freshSession,
    getName,
    matches,
    movies,
    readSession,
    saveSession,
    setName,
    type Movie,
    type Session,
} from './model';
import './styles.css';

function Header({name}: {name: string}) {
    return (
        <header className='header'>
            <span className='logo'>Swipey</span>
            <div className='profile'>
                <span title={name}>{name}</span>
                <UserRound size={24} fill='currentColor' />
            </div>
        </header>
    );
}
function Intro({children}: {children: React.ReactNode}) {
    return (
        <main className='intro'>
            <div className='intro__content'>{children}</div>
            <footer>Выбери кино или сериал на вечер</footer>
        </main>
    );
}
function Poster({movie, small = false}: {movie: Movie; small?: boolean}) {
    return (
        <div
            className={`poster poster--${movie.id}${small ? ' poster--small' : ''}`}
            style={movie.poster ? {backgroundImage: `url(${movie.poster})`} : {}}
        >
            {!movie.poster && (
                <div className='poster__fallback'>
                    <span className='poster__shape'>✦</span>
                    <strong>{movie.title}</strong>
                    <small>
                        {movie.year} · {movie.genre}
                    </small>
                </div>
            )}
        </div>
    );
}
function NamePage() {
    const nav = useNavigate();
    const [name, set] = useState(getName());
    return (
        <Intro>
            <div className='welcome'>
                <h1>Swipey</h1>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!name.trim()) return;
                        setName(name.trim().slice(0, 40));
                        nav('/start');
                    }}
                    className='name-field'
                >
                    <input
                        aria-label='Введите имя'
                        maxLength={40}
                        autoFocus
                        placeholder='Введите имя'
                        value={name}
                        onChange={(e) => set(e.target.value)}
                    />
                    <button aria-label='Сохранить имя' type='submit' disabled={!name.trim()}>
                        <Check />
                    </button>
                </form>
            </div>
        </Intro>
    );
}
function StartPage() {
    const nav = useNavigate();
    const name = getName();
    useEffect(() => {
        if (!name) nav('/', {replace: true});
    }, [name, nav]);
    return (
        <Intro>
            <div className='start-actions'>
                <button
                    onClick={() => {
                        saveSession(freshSession(name));
                        nav('/swipe');
                    }}
                >
                    Начать
                </button>
                <button onClick={() => nav('/scan')}>Подключиться</button>
            </div>
        </Intro>
    );
}
function SwipeCard({movie, onChoice, disabled}: {movie: Movie; onChoice: (liked: boolean) => void; disabled: boolean}) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-220, 220], [-16, 16]);
    const yes = useTransform(x, [0, 110], [0, 1]);
    const no = useTransform(x, [-110, 0], [1, 0]);
    const busy = useRef(false);
    function choose(liked: boolean) {
        if (busy.current || disabled) return;
        busy.current = true;
        animate(x, liked ? 550 : -550, {duration: 0.28}).then(() => onChoice(liked));
    }
    return (
        <motion.div
            className='swipe-card'
            style={{x, rotate}}
            drag={disabled ? false : 'x'}
            dragConstraints={{left: 0, right: 0}}
            dragElastic={0.95}
            onDragEnd={(_e, info) => {
                if (Math.abs(info.offset.x) > 95 || Math.abs(info.velocity.x) > 650) choose(info.offset.x > 0);
                else animate(x, 0, {type: 'spring', stiffness: 300, damping: 22});
            }}
        >
            <Poster movie={movie} />
            <div className='card-shade' />
            <span className='card-label'>Кино и сериалы</span>
            <motion.span className='vote-stamp vote-stamp--yes' style={{opacity: yes}}>
                НРАВИТСЯ
            </motion.span>
            <motion.span className='vote-stamp vote-stamp--no' style={{opacity: no}}>
                НЕ МОЁ
            </motion.span>
            <span className='card-meta'>
                <strong>{movie.title}</strong>
                <small>
                    {movie.year} · {movie.genre}
                </small>
            </span>
            <div className='drag-hotspot'>
                <button onClick={() => choose(false)} aria-label='Не нравится' disabled={disabled}>
                    ←
                </button>
                <button onClick={() => choose(true)} aria-label='Нравится' disabled={disabled}>
                    →
                </button>
            </div>
        </motion.div>
    );
}
function SwipePage() {
    const nav = useNavigate();
    const [s, set] = useState<Session | null>(() => readSession());
    const [locked, setLocked] = useState(false);
    useEffect(() => {
        if (!s) nav('/start', {replace: true});
        else if (s.votes.length === s.order.length) nav(s.role === 1 ? '/share' : '/results', {replace: true});
    }, [s, nav]);
    if (!s) return null;
    const id = s.order[s.votes.length];
    const movie = movies.find((m) => m.id === id);
    const update = (liked: boolean) => {
        if (locked || !movie) return;
        setLocked(true);
        const next = {...s, votes: [...s.votes, {id: movie.id, liked}]};
        saveSession(next);
        set(next);
        setLocked(false);
    };
    const undo = () => {
        if (!s.votes.length || locked) return;
        const next = {...s, votes: s.votes.slice(0, -1)};
        saveSession(next);
        set(next);
    };
    return (
        <main className='workspace'>
            <Header name={s.name} />
            <div className='swipe-area'>
                <div className='progress-line'>
                    <span>{s.role === 1 ? 'Первый игрок' : 'Второй игрок'}</span>
                    <span>{s.votes.length} / 15</span>
                </div>
                <div className='progress-track'>
                    <div style={{width: `${(s.votes.length / 15) * 100}%`}} />
                </div>
                {movie && (
                    <React.Fragment key={id}>
                        <SwipeCard movie={movie} onChoice={update} disabled={locked} />
                        <div className='vote-buttons'>
                            <button onClick={() => update(false)} className='no' aria-label='Дизлайк'>
                                <HeartCrack size={64} fill='currentColor' />
                            </button>
                            <button onClick={() => update(true)} className='yes' aria-label='Лайк'>
                                <Heart size={64} fill='currentColor' />
                            </button>
                        </div>
                    </React.Fragment>
                )}
                <div className='bottom-actions'>
                    <button onClick={undo} disabled={!s.votes.length}>
                        <RotateCcw size={17} /> Отменить
                    </button>
                    <button onClick={() => nav(s.role === 1 ? '/share' : '/results')} disabled={s.votes.length < 15}>
                        Завершить
                    </button>
                </div>
            </div>
        </main>
    );
}
function SharePage() {
    const nav = useNavigate();
    const s = readSession();
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!s || s.role !== 1 || s.votes.length !== 15) nav('/start', {replace: true});
    }, [s, nav]);
    if (!s || s.role !== 1) return null;
    const inv = createInvitation(s);
    const link = `${location.origin}/join#s=${encodeInvitation(inv)}`;
    function same() {
        saveSession(freshSession('Второй игрок', {name: inv.name, likes: inv.likes}));
        nav('/join#s=' + encodeInvitation(inv));
    }
    return (
        <Intro>
            <div className='qr-content'>
                <h2>Отсканируйте QR-код, чтобы подключиться</h2>
                <div className='qr-square'>
                    <QRCodeSVG value={link} size={206} marginSize={1} />
                </div>
                <p>Передайте ссылку второму игроку</p>
                <button
                    className='outline-button'
                    onClick={async () => {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                    }}
                >
                    <Copy size={18} />
                    {copied ? 'Скопировано' : 'Скопировать ссылку'}
                </button>
                <button className='text-button' onClick={same}>
                    Продолжить на этом телефоне
                </button>
            </div>
        </Intro>
    );
}
function JoinPage() {
    const nav = useNavigate();
    const loc = useLocation();
    const encoded = new URLSearchParams(loc.hash.slice(1)).get('s');
    const invitation = encoded ? decodeInvitation(encoded) : null;
    const [name, set] = useState(getName());
    if (!invitation)
        return (
            <Intro>
                <div className='center-block'>
                    <h2>Приглашение не найдено</h2>
                    <button className='primary' onClick={() => nav('/scan')}>
                        Сканировать QR
                    </button>
                </div>
            </Intro>
        );
    return (
        <Intro>
            <form
                className='join-form'
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    const first = {name: invitation.name, likes: invitation.likes};
                    setName(name.trim());
                    saveSession(freshSession(name.trim(), first));
                    nav('/swipe');
                }}
            >
                <h2>{invitation.name} приглашает выбрать кино вместе!</h2>
                <p>Оцените те же 15 фильмов, и мы найдём совпадения</p>
                <input
                    aria-label='Ваше имя'
                    maxLength={40}
                    placeholder='Ваше имя'
                    value={name}
                    onChange={(e) => set(e.target.value)}
                />
                <button className='primary' disabled={!name.trim()}>
                    Присоединиться
                </button>
            </form>
        </Intro>
    );
}
function ScanPage() {
    const nav = useNavigate();
    const video = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState('');
    const [link, setLink] = useState('');
    useEffect(() => {
        let stopped = false;
        const scanner = new BrowserQRCodeReader();
        let controls: {stop: () => void} | undefined;
        async function go() {
            try {
                controls = await scanner.decodeFromVideoDevice(undefined, video.current!, (result) => {
                    if (stopped || !result) return;
                    const value = result.getText();
                    try {
                        const parsed = new URL(value);
                        const encoded = new URLSearchParams(parsed.hash.slice(1)).get('s');
                        if (!encoded || !decodeInvitation(encoded)) throw Error();
                        stopped = true;
                        controls?.stop();
                        nav('/join#s=' + encoded);
                    } catch {
                        setError('QR-код не содержит приглашение Swipey');
                    }
                });
            } catch {
                setError('Нет доступа к камере. Вставьте ссылку вручную.');
            }
        }
        go();
        return () => {
            stopped = true;
            controls?.stop();
        };
    }, [nav]);
    function connect() {
        try {
            const url = new URL(link);
            const encoded = new URLSearchParams(url.hash.slice(1)).get('s');
            if (!encoded || !decodeInvitation(encoded)) throw Error();
            nav('/join#s=' + encoded);
        } catch {
            setError('Проверьте ссылку приглашения');
        }
    }
    return (
        <Intro>
            <div className='scan-content'>
                <h2>Наведите камеру на QR-код, чтобы подключиться</h2>
                <div className='scan-window'>
                    <video autoPlay muted playsInline ref={video} />
                    <ScanLine />
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        connect();
                    }}
                >
                    <input
                        aria-label='Ссылка приглашения'
                        value={link}
                        placeholder='Или вставьте ссылку'
                        onChange={(e) => setLink(e.target.value)}
                    />
                    <button className='primary'>Открыть</button>
                </form>
                {error && <p role='alert'>{error}</p>}
                <button className='text-button' onClick={() => nav('/start')}>
                    Назад
                </button>
            </div>
        </Intro>
    );
}
function ResultsPage() {
    const nav = useNavigate();
    const s = readSession();
    const [tab, setTab] = useState<'matches' | 'personal'>('matches');
    const [person, setPerson] = useState<1 | 2>(2);
    if (!s || s.role !== 2 || !s.first || s.votes.length !== 15)
        return (
            <Intro>
                <div className='center-block'>
                    <h2>Пока нет результатов</h2>
                    <button className='primary' onClick={() => nav('/start')}>
                        На главную
                    </button>
                </div>
            </Intro>
        );
    const mine = s.votes.filter((v) => v.liked).map((v) => v.id);
    const shown = tab === 'matches' ? matches(s.first.likes, mine) : person === 1 ? s.first.likes : mine;
    return (
        <main className='workspace'>
            <Header name={s.name} />
            <section className='result-area'>
                <nav className='result-tabs'>
                    <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>
                        Совпадения
                    </button>
                    <button className={tab === 'personal' ? 'active' : ''} onClick={() => setTab('personal')}>
                        Мой результат
                    </button>
                </nav>
                {tab === 'personal' && (
                    <div className='person-tabs'>
                        <button className={person === 1 ? 'selected' : ''} onClick={() => setPerson(1)}>
                            {s.first.name}
                        </button>
                        <button className={person === 2 ? 'selected' : ''} onClick={() => setPerson(2)}>
                            {s.name}
                        </button>
                    </div>
                )}
                {shown.length ? (
                    <div className='movie-grid'>
                        {shown.map((id) => {
                            const m = movies.find((x) => x.id === id);
                            return m ? (
                                <div key={id} title={m.title}>
                                    <Poster movie={m} small />
                                </div>
                            ) : null;
                        })}
                    </div>
                ) : (
                    <div className='empty-state'>
                        <HeartCrack size={50} />
                        <h2>Пока нет совпадений</h2>
                        <p>Может быть, вы выберете что-то новое в следующий раз?</p>
                    </div>
                )}
                <div className='result-footer'>
                    <button
                        onClick={() => {
                            clearSession();
                            nav('/start');
                        }}
                    >
                        <RotateCcw size={16} /> Начать снова
                    </button>
                    <button
                        onClick={async () => {
                            const share = window.location.href;
                            if (navigator.share) await navigator.share({title: 'Swipey', url: share});
                            else await navigator.clipboard.writeText(share);
                        }}
                    >
                        <Share2 size={16} /> Поделиться
                    </button>
                </div>
            </section>
        </main>
    );
}
function App() {
    const loc = useLocation();
    if (loc.pathname === '/join') return <JoinPage />;
    if (loc.pathname === '/start') return <StartPage />;
    if (loc.pathname === '/swipe') return <SwipePage />;
    if (loc.pathname === '/share') return <SharePage />;
    if (loc.pathname === '/scan') return <ScanPage />;
    if (loc.pathname === '/results') return <ResultsPage />;
    return <NamePage />;
}
createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
