import AudioPlayer from "../AudioPlayer";
import FadeInSection from "../FadeInSection";

interface DemosSectionProps {
    siteContent: any; // Type strictly if possible
    demos: any[];
    currentAudioIndex: number;
    isAudioPlaying: boolean;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (time: number) => void;
    currentTime: number;
    duration: number;
    onTrackSelect: (index: number) => void;
}

export default function DemosSection({
    siteContent,
    demos,
    currentAudioIndex,
    isAudioPlaying,
    onPlayPause,
    onNext,
    onPrev,
    onSeek,
    currentTime,
    duration,
    onTrackSelect
}: DemosSectionProps) {
    return (
        <section key="demos" id="demos" className="pt-32 pb-6 md:pt-40 md:pb-10 px-6 relative overflow-hidden scroll-mt-28">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--theme-primary)]/5 via-slate-50 to-slate-50 -z-10" />
            <FadeInSection className="container mx-auto max-w-4xl text-center mb-12">
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-[var(--theme-primary)]">
                    {siteContent.heroTitle}
                </h1>
                <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto">
                    {siteContent.heroSubtitle}
                </p>
                <AudioPlayer
                    tracks={demos}
                    currentTrackIndex={currentAudioIndex}
                    isPlaying={isAudioPlaying}
                    onPlayPause={onPlayPause}
                    onNext={onNext}
                    onPrev={onPrev}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    duration={duration}
                    onTrackSelect={onTrackSelect}
                    ownerName={siteContent.siteName}
                />
            </FadeInSection>
        </section>
    );
}
