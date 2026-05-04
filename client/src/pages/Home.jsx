import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderOpen, PenTool, ArrowRight } from 'lucide-react';
import whiteboardImg from '../assets/whiteboard.jpg';
// we need to make it a webp because 80kb of jpg each time pages load is crazy

export default function Home() {
    const [scrollY, setScrollY] = useState(0);
    const [navSolid, setNavSolid] = useState(false);
    const boardRef = useRef(null);

    useEffect(() => {
        let ticking = false;
        function onScroll() {
            if (!ticking) {
                requestAnimationFrame(() => {
                    setScrollY(window.scrollY);
                    setNavSolid(window.scrollY > 40);
                    ticking = false;
                });
                ticking = true;
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // parallax effect values here
    const rotateY = -6 + scrollY * 0.008;
    const rotateX = 4 - scrollY * 0.005;
    const translateY = scrollY * 0.15;

    return (
        <div className="min-h-screen bg-white text-gray-700 overflow-x-hidden">

            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    navSolid
                        ? 'bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm'
                        : 'bg-transparent'
                }`}
            >
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="text-xl font-semibold select-none">
                        <span className="text-violet-600">Sync</span>
                        <span className="text-gray-900">Board</span>
                    </Link>
                    <div className="hidden sm:flex items-center gap-8 text-sm">
                        <a href="#features" className="text-gray-500 hover:text-gray-800 transition">
                            Features
                        </a>
                        <a href="#how" className="text-gray-500 hover:text-gray-800 transition">
                            How it works
                        </a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="text-sm text-gray-500 hover:text-gray-800 transition px-3 py-1.5"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition shadow-sm"
                        >
                            Get started
                        </Link>
                    </div>
                </div>
            </nav>


            <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">

                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-40" />
                    <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-violet-50 rounded-full blur-3xl opacity-50" />
                </div>

                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
  
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-gray-900 leading-tight tracking-tight">
                                Your ideas,
                                <br />
                                <span className="text-violet-600">in sync.</span>
                            </h1>
                            <p className="mt-5 text-lg text-gray-500 max-w-lg mx-auto md:mx-0 leading-relaxed">
                                A collaborative whiteboard for teams that think together.
                                Draw, sketch, and brainstorm in real time.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition shadow-sm text-sm"
                                >
                                    Start for free
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                                >
                                    I have an account
                                </Link>
                            </div>
                        </div>

  
                        <div className="flex-1 flex justify-center w-full md:w-auto">
                            <div
                                className="relative"
                                style={{ perspective: '1200px' }}
                                ref={boardRef}
                            >
                                {/**shadow has to follow the image */}
                                <div
                                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[85%] h-8 bg-gray-900/10 rounded-full blur-xl"
                                    style={{
                                        transform: `translateX(-50%) scaleX(${1 - scrollY * 0.0005})`,
                                    }}
                                />

                                <div
                                    className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-2xl bg-white"
                                    style={{
                                        width: 'min(480px, 80vw)',
                                        aspectRatio: '16 / 10',
                                        transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateY(${translateY}px)`,
                                        transition: 'transform 0.1s ease-out',
                                        transformStyle: 'preserve-3d',
                                    }}
                                >
                                    <div className="absolute inset-0 rounded-2xl border-[4px] border-white z-10 pointer-events-none" />
                                    <img
                                        src={whiteboardImg}
                                        alt="SyncBoard whiteboard preview"
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="features" className="py-20 md:py-28 bg-gray-50/60">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
                            Everything you need on one board
                        </h2>
                        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
                            No clutter, no learning curve. Just the tools that help you get your point across.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl border border-gray-200 p-7 hover:border-violet-200 hover:shadow-sm transition">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                                <Users className="w-5 h-5 text-violet-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Real-time collaboration
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                See cursors, strokes, and edits as they happen. Everyone stays on the same page literally.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-7 hover:border-violet-200 hover:shadow-sm transition">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                                <FolderOpen className="w-5 h-5 text-violet-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Organized workspace
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                Folders, boards, and sharing keep everything where it belongs so you can find it later.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-7 hover:border-violet-200 hover:shadow-sm transition">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                                <PenTool className="w-5 h-5 text-violet-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Draw your way
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                Pen, shapes, highlighter, eraser tools that stay out of your way and let you focus on the idea.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="how" className="py-20 md:py-28">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
                            Three steps to collaboration
                        </h2>
                        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
                            No setup wizards, no integrations to configure. Just create and share.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                        {[
                            { step: '1', title: 'Create a board', desc: 'Give it a name. That\'s all it takes to start.' },
                            { step: '2', title: 'Invite your team', desc: 'Share a link. They\'re on the board in seconds.' },
                            { step: '3', title: 'Start drawing', desc: 'Sketch, annotate, brainstorm together, in real time.' },
                        ].map((item) => (
                            <div key={item.step} className="text-center">
                                <div className="w-10 h-10 rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center mx-auto mb-4">
                                    {item.step}
                                </div>
                                <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                                <p className="text-sm text-gray-500">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 md:py-28 bg-gray-50/60">
                <div className="max-w-2xl mx-auto px-6 text-center">
                    <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
                        Start with a blank canvas
                    </h2>
                    <p className="mt-3 text-gray-500">
                        No credit card. No friction. Just you and your ideas.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/signup"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition shadow-sm text-sm"
                        >
                            Create your first board
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-gray-100 py-8">
                <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
                    <span className="font-medium">
                        <span className="text-violet-600">Sync</span>
                        <span className="text-gray-500">Board</span>
                    </span>
                    <span>&copy; {new Date().getFullYear()} SyncBoard. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}