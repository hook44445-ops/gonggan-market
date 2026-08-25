import {
  CheckCircle2, AlertTriangle, MessageCircle, ShieldCheck, MapPin, Check, ClipboardList,
  Lock, X, PenLine, Home, Camera, Building2, Star, BadgeCheck, Heart, Wallet, Flame,
  Thermometer, Eye, Search, XCircle, FileText, FolderOpen, FolderClosed, Ban, CircleSlash,
  Lightbulb, Bell, Pencil, Handshake, CalendarClock, Circle, Bookmark, Calendar, BarChart3,
  Hammer, Coffee, Award, RefreshCw, Wrench, Trophy, Puzzle, Receipt, Folder, User, Sprout,
  Zap, Target, BookOpen, Settings, Pin, TrendingUp, CreditCard, Radio, Smartphone, Leaf,
  Satellite, AlertOctagon, Scale, MailX, Trash2, Newspaper, Link2, ThumbsUp, Coins,
  FlaskConical, Flag, Bot, Sparkles, ArrowUpRight, Construction,
  Sofa, Briefcase, Store, ShowerHead, CookingPot, PaintRoller, DoorOpen,
  Ruler, SearchX, CheckCheck, Landmark, Banknote, Clock,
  Mail, HelpCircle, KeyRound, Package,
  Upload, Microscope,
  Hand, Plus, Sunrise, Globe, Factory, Users, Moon, Library, Phone, Repeat,
  ChevronDown, Network, Archive, Map, OctagonX, Dna, Compass, Blocks, Eraser,
  Stethoscope, Mountain, BellOff,
} from "lucide-react";
import { C } from "../../constants";
import { useIconVersion } from "../../hooks/useIconVersion";

// ─────────────────────────────────────────────────────
// 유치하거나 톤이 안 맞는 이모지 아이콘을, 브랜드 톤(딥그린 라인)에 맞춘
// lucide 아이콘으로 일괄 대체하기 위한 매핑. v1(기존 이모지)/v2(신규) 를
// useIconVersion 스위치로 즉시 전환할 수 있다.
// 매핑에 없는 이모지는 원본 그대로 렌더(안전한 폴백) — 점진적으로 확장.
// ─────────────────────────────────────────────────────
const EMOJI_ICON_MAP = {
  "✅": CheckCircle2, "✔": Check, "✓": Check,
  "⚠️": AlertTriangle, "⚠": AlertTriangle,
  "💬": MessageCircle,
  "🛡️": ShieldCheck, "🛡": ShieldCheck,
  "📍": MapPin, "📌": Pin,
  "📋": ClipboardList,
  "🔒": Lock,
  "✕": X, "✗": X, "❌": XCircle,
  "📝": PenLine, "✏️": Pencil, "✏": Pencil,
  "🏠": Home, "🏡": Home,
  "📷": Camera, "📸": Camera,
  "🏗️": Construction, "🏗": Construction,
  "🏢": Building2,
  "★": Star, "⭐": Star, "⭐️": Star,
  "🎉": BadgeCheck, "🎊": BadgeCheck, "🥳": BadgeCheck, "💯": BadgeCheck,
  "❤️": Heart, "❤": Heart, "♥": Heart, "💖": Heart,
  "💰": Wallet, "🪙": Coins, "💳": CreditCard, "🧾": Receipt,
  "🔥": Flame,
  "🌡️": Thermometer, "🌡": Thermometer,
  "👁️": Eye, "👁": Eye, "👀": Eye,
  "🔍": Search, "🔎": Search,
  "📄": FileText, "📖": BookOpen,
  "🗂️": FolderOpen, "🗂": FolderOpen, "📂": FolderOpen, "📁": Folder,
  "⛔": Ban, "🚫": CircleSlash, "🚩": Flag,
  "💡": Lightbulb,
  "🔔": Bell,
  "🤝": Handshake,
  "🗓️": CalendarClock, "🗓": CalendarClock, "📅": Calendar,
  "🚀": ArrowUpRight,
  "🟢": Circle, "⚪": Circle,
  "✨": Sparkles,
  "🤖": Bot,
  "🔖": Bookmark,
  "📊": BarChart3, "📈": TrendingUp,
  "🔨": Hammer, "🔧": Wrench, "🛠️": Wrench, "🛠": Wrench,
  "☕": Coffee,
  "🏅": Award, "🏆": Trophy,
  "🔄": RefreshCw,
  "🧪": FlaskConical,
  "🧩": Puzzle,
  "👤": User,
  "🌱": Sprout, "🌿": Leaf,
  "⚡": Zap,
  "🎯": Target,
  "⚙️": Settings, "⚙": Settings,
  "📡": Radio, "🛰️": Satellite, "🛰": Satellite,
  "📱": Smartphone,
  "🚨": AlertOctagon,
  "⚖️": Scale, "⚖": Scale,
  "📭": MailX,
  "🗑️": Trash2, "🗑": Trash2,
  "🗞️": Newspaper, "🗞": Newspaper,
  "🔗": Link2,
  "👍": ThumbsUp, "🙌": ThumbsUp,
  "🛋️": Sofa, "🛋": Sofa,
  "💼": Briefcase,
  "🏪": Store,
  "🚿": ShowerHead,
  "🍳": CookingPot,
  "🪵": PaintRoller,
  "🚪": DoorOpen,
  "📐": Ruler,
  "😢": SearchX,
  "🏁": CheckCheck,
  "🏦": Landmark,
  "💸": Banknote,
  "⏳": Clock,
  "📨": Mail, "📩": Mail,
  "❔": HelpCircle, "❓": HelpCircle,
  "🔐": KeyRound,
  "📦": Package,
  "🗨️": MessageCircle, "🗨": MessageCircle,
  "🏘️": Building2, "🏘": Building2,
  "🔕": BellOff,
  "📤": Upload,
  "🔬": Microscope,
  "☆": Star,
  "✋": Hand,
  "✍️": PenLine, "✍": PenLine,
  "➕": Plus,
  "🌅": Sunrise,
  "🌌": Globe,
  "🌍": Globe,
  "🏭": Factory,
  "👥": Users,
  "💤": Moon,
  "📚": Library,
  "📞": Phone,
  "📰": Newspaper,
  "🔁": Repeat,
  "🔮": Sparkles,
  "🔻": ChevronDown,
  "🕒": Clock,
  "🕵️": Search, "🕵": Search,
  "🕸️": Network, "🕸": Network,
  "🗄️": Archive, "🗄": Archive,
  "🗺️": Map, "🗺": Map,
  "🛑": OctagonX,
  "🧬": Dna,
  "🧭": Compass,
  "🧱": Blocks,
  "🧹": Eraser,
  "🩺": Stethoscope,
  "🪨": Mountain,
};

// 첫 글자가 매핑된 이모지면 분리해서 {emoji, rest} 로 반환한다.
// showToast("✅ 저장됐어요") 처럼 문자열 맨 앞에 이모지를 붙이는 기존 호출부를
// 하나도 고치지 않고, 렌더 지점 한 곳에서만 아이콘화할 때 사용한다.
const LEADING_EMOJI_RE = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?)\s*/u;
export function splitLeadingEmoji(text) {
  const s = String(text ?? "");
  const m = s.match(LEADING_EMOJI_RE);
  if (!m) return { emoji: null, rest: s };
  return { emoji: m[1].replace(/️$/, ""), rest: s.slice(m[0].length) };
}

/**
 * <Icon emoji="🎉" /> — v2(기본)에서는 매핑된 lucide 라인 아이콘을,
 * v1(관리자 토글)에서는 기존 이모지를 그대로 렌더한다.
 * size/color/strokeWidth 는 v2 렌더에만 적용(이모지는 폰트 색상 그대로).
 */
export function Icon({ emoji, size = 18, color = C.text2, strokeWidth = 1.8, className, style }) {
  const [version] = useIconVersion();
  if (version === "v1") {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  const Cmp = EMOJI_ICON_MAP[emoji];
  if (!Cmp) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] "${emoji}" 에 대한 v2 아이콘 매핑이 아직 없어 원본 이모지로 표시합니다.`);
    }
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <Cmp
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-hidden="true"
    />
  );
}

export default Icon;
