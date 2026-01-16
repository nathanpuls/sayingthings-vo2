import { motion, AnimatePresence } from "framer-motion";
import { X, Menu } from "lucide-react";

interface HomeNavProps {
    isScrolled: boolean;
    siteName: string;
    navLinks: { name: string; href: string }[];
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
}

export default function HomeNav({ isScrolled, siteName, navLinks, mobileMenuOpen, setMobileMenuOpen }: HomeNavProps) {
    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-4 border-b border-slate-200" : "bg-transparent py-6"
                }`}
        >
            <div className="w-full px-4 md:px-6 flex justify-between items-center relative">
                <div className="flex items-center gap-6">
                    <a href={window.location.pathname} className="flex items-center gap-2 group z-10 relative">
                        <span className="text-2xl font-semibold text-slate-900 group-hover:text-[var(--theme-primary)] transition-colors">
                            {siteName}
                        </span>
                    </a>
                </div>

                {/* Desktop Nav */}
                <div className="hidden md:flex gap-8 z-10 relative">
                    {navLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            className="text-sm font-medium text-slate-600 hover:text-[var(--theme-primary)] transition-colors"
                        >
                            {link.name}
                        </a>
                    ))}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-slate-600 hover:text-indigo-600 z-10 relative"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Nav */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden bg-white border-b border-slate-200 overflow-hidden shadow-lg"
                    >
                        <div className="flex flex-col gap-4 p-6">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-lg font-medium text-slate-600 hover:text-indigo-600"
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
