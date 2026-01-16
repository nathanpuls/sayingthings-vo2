import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import EmbedPlayer from "./pages/EmbedPlayer";
import VoiceClipsEmbed from "./pages/VoiceClipsEmbed";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/embed/audioplayer/:uid" element={<EmbedPlayer />} />
        <Route path="/embed/voiceclips/:uid" element={<VoiceClipsEmbed />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/Admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
