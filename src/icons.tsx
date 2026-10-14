/* Icon set: Phosphor (regular weight), exposed under the app's existing names. */
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import {
  ArrowSquareOut, Compass, ArrowBendDownRight, ThumbsDown, ThumbsUp, Globe, PlugsConnected, Paperclip, Buildings, Check, Crosshair, Laptop, ArrowsClockwise, Bell, BookOpen, CalendarBlank, CaretDown, CaretUpDown,
  ChartBar, ChatCircle, Clipboard, Clock, Code, Copy, CornersOut,
  DownloadSimple, Export, File, FileText, FolderSimple, FolderSimplePlus, Gavel, Gear,
  GitFork, HardDrives, Image, MagnifyingGlass, Microphone, Minus, Moon,
  Palette, Plus, Question, Robot, ShieldCheck, SidebarSimple, SlidersHorizontal, Sparkle,
  Stack, Star, Storefront, Sun, Table, TextT, TreeStructure, Flask, X, Graph, ListBullets, Tray,
  ArrowLeft, Lock, PencilSimple, XCircle, Info, Lightbulb, Funnel,
} from '@phosphor-icons/react'

type P = { className?: string }

const I = (Ph: PhosphorIcon) => ({ className }: P) => <Ph className={className} size={20} aria-hidden="true" />

export const IconNewChat = I(Plus)
export const IconProjects = I(FolderSimple)
export const IconAgent = I(Robot)
export const IconWorkflow = I(TreeStructure)
export const IconMarket = I(Storefront)
export const IconResearch = I(Flask)
export const IconApps = I(Stack)
export const IconAdmin = I(ShieldCheck)
export const IconSettings = I(Gear)
export const IconPanel = I(SidebarSimple)
export const IconChevron = I(CaretDown)
export const IconSearch = I(MagnifyingGlass)
export const IconBell = I(Bell)
export const IconHelp = I(Question)
export const IconMic = I(Microphone)
/* Custom send mark: a solid plane with a lighter second wing. It takes the button's text colour. */
export const IconSend = ({ className }: P) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1.80668 11.3465L2.96668 9.02649C3.28668 8.37982 3.28668 7.62649 2.96668 6.97982L1.80668 4.65315C0.813348 2.66649 2.95335 0.566486 4.92001 1.60649L5.94668 2.15315C6.09335 2.22649 6.20668 2.34649 6.26668 2.49315L10.06 10.9265C10.2133 11.2732 10.0733 11.6798 9.74001 11.8532L4.91335 14.3932C2.95335 15.4332 0.813348 13.3332 1.80668 11.3465Z" fill="currentColor" />
    <path opacity="0.8" d="M10.8733 10.4003L8.38667 4.8803C8.10667 4.2603 8.77334 3.63363 9.37334 3.95363L13.22 5.9803C14.8533 6.8403 14.8533 9.17363 13.22 10.0336L11.86 10.747C11.4933 10.9336 11.0467 10.7803 10.8733 10.4003Z" fill="currentColor" />
  </svg>
)
export const IconScope = I(File)
export const IconFolderPlus = I(FolderSimplePlus)
export const IconSpark = I(Sparkle)
export const IconMoon = I(Moon)
export const IconClose = I(X)
export const IconSliders = I(SlidersHorizontal)
export const IconChat = I(ChatCircle)
export const IconFork = I(GitFork)
export const IconStar = I(Star)
export const IconGrid = I(Table)
export const IconCode = I(Code)
export const IconBars = I(ChartBar)
export const IconDownload = I(DownloadSimple)
export const IconShare = I(Export)
export const IconSort = I(CaretUpDown)
export const IconFile = I(FileText)
export const IconRecords = I(Clipboard)
export const IconClock = I(Clock)
export const IconFolder = I(FolderSimple)
export const IconSun = I(Sun)
export const IconPalette = I(Palette)
export const IconImage = I(Image)
export const IconRefresh = I(ArrowsClockwise)
export const IconCopy = I(Copy)
export const IconType = I(TextT)
export const IconBook = I(BookOpen)
export const IconServer = I(HardDrives)
export const IconGavel = I(Gavel)
export const IconCalendar = I(CalendarBlank)
export const IconExpand = I(CornersOut)
export const IconPlus = I(Plus)
export const IconMinus = I(Minus)
export const IconExternal = I(ArrowSquareOut)
export const IconOntology = I(Graph)
export const IconList = I(ListBullets)
export const IconInbox = I(Tray)
export const IconTarget = I(Crosshair)
export const IconLocal = I(Laptop)
export const IconOrg = I(Buildings)
export const IconCheck = I(Check)
export const IconAttach = I(Paperclip)
export const IconGlobe = I(Globe)
export const IconPlug = I(PlugsConnected)
export const IconThumbUp = I(ThumbsUp)
export const IconThumbDown = I(ThumbsDown)
export const IconFollow = I(ArrowBendDownRight)
export const IconRoute = I(Compass)
/* Feedback is a like and dislike pair, drawn as two small thumbs. */
export const IconFeedback = ({ className }: P) => (
  <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2, height: 20 }} aria-hidden="true">
    <ThumbsUp size={12} />
    <ThumbsDown size={12} />
  </span>
)
export const IconBack = I(ArrowLeft)
export const IconLock = I(Lock)
export const IconEdit = I(PencilSimple)
export const IconError = I(XCircle)
export const IconInfo = I(Info)
export const IconLightbulb = I(Lightbulb)
export const IconFilter = I(Funnel)
