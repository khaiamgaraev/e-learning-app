"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  ArrowLeft,
  Save,
  Eye,
  CalendarDays,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Clock,
  MapPin,
  UserCheck,
  BookOpen,
  Layers
} from "lucide-react";

type Course = {
  id: number;
  name: string;
  day: number | null;
  time: string;
  floor: number | null;
  room: string;
  lecturer: string;
  recommended: string;
};

type SessionCard = {
  id: string;
  session_title: string;
  specialty_id: number;
  created_at: string;
};

type LecturerRecommendation = {
  subject_name: string;
  lecturer_names: string[];
};

const DAY_OPTIONS = [
  { value: 1, label: "Bazar ertəsi" },
  { value: 2, label: "Çərşənbə axşamı" },
  { value: 3, label: "Çərşənbə" },
  { value: 4, label: "Cümə axşamı" },
  { value: 5, label: "Cümə" },
  { value: 6, label: "Şənbə" },
  { value: 7, label: "Bazar" },
];

const FLOOR_OPTIONS = Array.from({ length: 13 }, (_, i) => ({
  value: i,
  label: `${i}-ci mərtəbə`,
}));

function getDeviceFingerprint(): string {
  let deviceId = localStorage.getItem("app_device_id");
  if (!deviceId) {
    const userAgent = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rawString = `${userAgent}-${screenRes}-${timezone}-${Math.random()}`;

    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    deviceId = `dev_${Math.abs(hash)}_${Date.now()}`;
    localStorage.setItem("app_device_id", deviceId);
  }
  return deviceId;
}

export default function Home() {
  const [deviceId, setDeviceId] = useState<string>("");
  const [majorOptions, setMajorOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);

  const [step, setStep] = useState<"cards" | "viewer" | "editor">("cards");
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitleInput, setSessionTitleInput] = useState("Payız semestri cədvəli");

  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendationsList, setRecommendationsList] = useState<LecturerRecommendation[]>([]);

  useEffect(() => {
    async function init() {
      const devId = getDeviceFingerprint();
      setDeviceId(devId);

      const { data: majorData } = await supabase.from("specialties").select("id, name");
      if (majorData) setMajorOptions(majorData);

      fetchSessions(devId);
    }
    init();
  }, []);

  async function fetchSessions(devId: string) {
    const { data, error } = await supabase
        .from("student_sessions")
        .select("*")
        .eq("device_id", devId)
        .order("created_at", { ascending: false });

    if (!error && data) {
      setSessions(data);
    } else {
      setSessions([]);
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Bu cədvəli silmək istədiyinizə əminsiniz?")) return;

    await supabase.from("student_schedules").delete().eq("session_id", sessionId);
    const { error } = await supabase.from("student_sessions").delete().eq("id", sessionId);

    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } else {
      alert("Silinərkən xəta baş verdi.");
    }
  }

  function handleStartNewSchedule() {
    if (!selectedMajorId) {
      alert("Zəhmət olmasa ixtisas seçin!");
      return;
    }
    setActiveSessionId(null);
    setIsUpdateMode(false);
    setSessionTitleInput("Yeni Cədvəl");
    loadSubjectsForMajor(selectedMajorId, null, "editor");
  }

  async function handleFetchRecommendations() {
    if (!selectedMajorId) {
      alert("Zəhmət olmasa əvvəlcə ixtisas seçin!");
      return;
    }

    setLoading(true);
    const { data: subjectsData } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .eq("specialty_id", selectedMajorId);

    if (!subjectsData || subjectsData.length === 0) {
      alert("Bu ixtisasa uyğun fənlər tapılmadı!");
      setRecommendationsList([]);
      setShowRecommendations(true);
      setLoading(false);
      return;
    }

    const recs: LecturerRecommendation[] = [];

    for (const sub of subjectsData) {
      const { data: lectData } = await supabase
          .from("recommended_lecturers")
          .select("lecturer_name")
          .eq("subject_id", sub.id);

      const names = lectData ? lectData.map((l) => l.lecturer_name) : [];
      recs.push({
        subject_name: sub.subject_name,
        lecturer_names: names,
      });
    }

    setRecommendationsList(recs);
    setShowRecommendations(true);
    setLoading(false);
  }

  async function handleOpenSession(session: SessionCard, targetStep: "viewer" | "editor") {
    setActiveSessionId(session.id);
    setSelectedMajorId(session.specialty_id);
    setSessionTitleInput(session.session_title);
    setIsUpdateMode(true);
    await loadSubjectsForMajor(session.specialty_id, session.id, targetStep);
  }

  async function loadSubjectsForMajor(majorId: number, sessionId: string | null, targetStep: "viewer" | "editor") {
    setLoading(true);
    const { data: subjectsData, error: subError } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .eq("specialty_id", majorId);

    if (subError || !subjectsData) {
      alert("Fənlər tapılmadı!");
      setLoading(false);
      return;
    }

    let savedSchedulesMap = new Map();
    if (sessionId) {
      const { data: schedData } = await supabase
          .from("student_schedules")
          .select("*")
          .eq("session_id", sessionId);

      if (schedData) {
        schedData.forEach((s) => savedSchedulesMap.set(s.subject_id, s));
      }
    }

    const coursesList: Course[] = [];

    for (const sub of subjectsData) {
      const saved = savedSchedulesMap.get(sub.id);

      const { data: lectData } = await supabase
          .from("recommended_lecturers")
          .select("lecturer_name")
          .eq("subject_id", sub.id);
      const lecturerNames = lectData ? lectData.map((l) => l.lecturer_name).join(", ") : "";

      let dayVal = 1;
      if (saved && saved.day_of_week) {
        const found = DAY_OPTIONS.find((d) => d.label === saved.day_of_week);
        if (found) dayVal = found.value;
      }

      let floorVal = 1;
      let roomVal = "";
      if (saved && saved.room_info) {
        const parts = saved.room_info.split(",");
        const floorMatch = parts[0]?.match(/\d+/);
        if (floorMatch) floorVal = Number(floorMatch[0]);
        if (parts[1]) roomVal = parts[1].replace("Otaq:", "").trim();
      }

      coursesList.push({
        id: sub.id,
        name: sub.subject_name,
        day: dayVal,
        time: saved?.class_time || "09:00",
        floor: floorVal,
        room: roomVal,
        lecturer: saved?.lecturer_name || (lecturerNames ? lecturerNames.split(",")[0].trim() : ""),
        recommended: lecturerNames || "—",
      });
    }

    coursesList.sort((a, b) => (a.day || 1) - (b.day || 1) || a.time.localeCompare(b.time));

    setActiveCourses(coursesList);
    setStep(targetStep);
    setLoading(false);
  }

  function handleCourseChange(index: number, field: keyof Course, value: any) {
    const updated = [...activeCourses];
    updated[index] = { ...updated[index], [field]: value };
    setActiveCourses(updated);
  }

  async function handleSaveSession(e: FormEvent) {
    e.preventDefault();
    if (!selectedMajorId) return;

    setLoading(true);
    let targetSessionId = activeSessionId;

    if (!isUpdateMode || !targetSessionId) {
      const { data: newSession, error: sessError } = await supabase
          .from("student_sessions")
          .insert({
            device_id: deviceId,
            specialty_id: selectedMajorId,
            session_title: sessionTitleInput.trim() || "Yeni Cədvəl",
          })
          .select()
          .single();

      if (sessError || !newSession) {
        alert("Səhv baş verdi: " + sessError?.message);
        setLoading(false);
        return;
      }
      targetSessionId = newSession.id;
    } else {
      await supabase
          .from("student_sessions")
          .update({ session_title: sessionTitleInput.trim() })
          .eq("id", targetSessionId);

      await supabase.from("student_schedules").delete().eq("session_id", targetSessionId);
    }

    const schedulesToInsert = activeCourses.map((course) => {
      const dayLabel = DAY_OPTIONS.find((d) => d.value === course.day)?.label || "Bazar ertəsi";
      return {
        session_id: targetSessionId,
        subject_id: course.id,
        day_of_week: dayLabel,
        class_time: course.time || "09:00",
        room_info: course.room ? `${course.floor}-ci mərtəbə, Otaq: ${course.room}` : `${course.floor}-ci mərtəbə`,
        lecturer_name: course.lecturer || course.recommended,
      };
    });

    const { error: insertError } = await supabase.from("student_schedules").insert(schedulesToInsert);

    if (insertError) {
      alert("Xəta: " + insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    alert("Cədvəl uğurla yadda saxlanıldı!");
    setStep("cards");
    fetchSessions(deviceId);
  }

  return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-zinc-800 relative overflow-x-hidden">

        {/* Magic UI Background Glow Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/10 blur-[120px] pointer-events-none rounded-full" />

        {/* Header - Shadcn / Vercel Navigation Style */}
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium tracking-tight text-zinc-200">Akademik Cədvəl İdarəetməsi</span>
            </div>
            <div className="text-xs text-zinc-400 font-mono">v2.0</div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">

          {step === "cards" && (
              <div className="space-y-8">

                {/* Hero Card Section */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-md relative overflow-hidden space-y-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                  <div className="space-y-2 relative z-10">
                    <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">İxtisas Paneli</span>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">İxtisasınızı seçin və cədvəlinizi qurun</h1>
                    <p className="text-sm text-zinc-400">Universitet dərslərinizi və lektorlarınızı rahatlıqla tənzimləyin.</p>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <label className="block text-xs font-medium text-zinc-300">
                      İxtisas Siyahısı
                    </label>
                    <select
                        value={selectedMajorId || ""}
                        onChange={(e) => {
                          setSelectedMajorId(Number(e.target.value));
                          setShowRecommendations(false);
                        }}
                        className="w-full h-12 px-4 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none transition-all text-sm shadow-inner"
                    >
                      <option value="" className="bg-zinc-900 text-zinc-500">— İxtisas seçin —</option>
                      {majorOptions.map((m) => (
                          <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-200">{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 relative z-10">
                    <button
                        type="button"
                        onClick={handleStartNewSchedule}
                        disabled={loading}
                        className="w-full sm:flex-1 h-12 rounded-xl bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" /> Yeni Cədvəl Qur
                    </button>

                    <button
                        type="button"
                        onClick={handleFetchRecommendations}
                        disabled={loading}
                        className="w-full sm:flex-1 h-12 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-200 text-sm font-medium transition-all flex items-center justify-center gap-2 hover:border-zinc-700 active:scale-[0.98]"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" /> Lektor Tövsiyəsi Al
                    </button>
                  </div>
                </div>

                {/* Recommendations Panel */}
                {showRecommendations && (
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
                      <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Tövsiyə Olunan Lektorlar
                    </span>
                        </div>
                        <button
                            onClick={() => setShowRecommendations(false)}
                            className="text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          Bağla
                        </button>
                      </div>

                      <div className="divide-y divide-zinc-800/60 max-h-96 overflow-y-auto">
                        {recommendationsList.map((rec, index) => (
                            <div key={index} className="p-6 space-y-2 hover:bg-zinc-800/20 transition-colors">
                              <h4 className="text-sm font-semibold text-zinc-200">{rec.subject_name}</h4>
                              {rec.lecturer_names.length > 0 ? (
                                  <ul className="space-y-1 text-xs text-zinc-400">
                                    {rec.lecturer_names.map((name, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                          {name}
                                        </li>
                                    ))}
                                  </ul>
                              ) : (
                                  <p className="text-xs text-zinc-600">Tövsiyə mövcud deyil</p>
                              )}
                            </div>
                        ))}

                        {recommendationsList.length === 0 && (
                            <div className="p-12 text-center text-xs text-zinc-500">
                              Heç bir məlumat tapılmadı.
                            </div>
                        )}
                      </div>
                    </div>
                )}

                {/* History Section */}
                <div className="space-y-4 pt-2">
                  <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    <History className="w-4 h-4" />
                    <span>Yadda Saxlanılan Cədvəllər ({sessions.length})</span>
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showHistory && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between gap-6 backdrop-blur-md"
                            >
                              <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="absolute top-5 right-5 p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
                                  title="Sil"
                              >
                                <X className="w-4 h-4" />
                              </button>

                              <div className="space-y-2 pr-8">
                        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md border border-zinc-700/50">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                                <h3 className="text-base font-semibold text-white tracking-tight">{session.session_title}</h3>
                              </div>

                              <div className="flex items-center gap-2 pt-4 border-t border-zinc-800/80">
                                <button
                                    onClick={() => handleOpenSession(session, "viewer")}
                                    className="flex-1 h-10 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-white transition-all shadow-sm"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Baxış
                                </button>
                                <button
                                    onClick={() => handleOpenSession(session, "editor")}
                                    className="h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-all"
                                >
                                  Redaktə
                                </button>
                              </div>
                            </div>
                        ))}

                        {sessions.length === 0 && (
                            <div className="col-span-full rounded-3xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
                              Heç bir yadda saxlanılmış cədvəl mövcud deyil.
                            </div>
                        )}
                      </div>
                  )}
                </div>

              </div>
          )}

          {step === "viewer" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Cədvəl Baxışı</span>
                    <h2 className="text-xl font-semibold text-white tracking-tight">{sessionTitleInput}</h2>
                  </div>
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => handleOpenSession({ id: activeSessionId!, session_title: sessionTitleInput, specialty_id: selectedMajorId!, created_at: "" }, "editor")}
                        className="flex-1 sm:flex-initial h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all"
                    >
                      Dəyişiklik Et
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep("cards")}
                        className="flex-1 sm:flex-initial h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Geri
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {DAY_OPTIONS.map((dayObj) => {
                    const dayCourses = activeCourses.filter((c) => c.day === dayObj.value);
                    if (dayCourses.length === 0) return null;

                    return (
                        <div key={dayObj.value} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl backdrop-blur-md">
                          <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-400" />
                        {dayObj.label}
                      </span>
                            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full border border-zinc-700/50">
                        {dayCourses.length} dərs
                      </span>
                          </div>

                          <div className="divide-y divide-zinc-800/60">
                            {dayCourses.map((course) => (
                                <div key={course.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors">
                                  <div className="space-y-1.5">
                                    <span className="text-sm font-semibold text-white">{course.name}</span>
                                    <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                                      <UserCheck className="w-3.5 h-3.5 text-zinc-500" />
                                      Müəllim: <strong className="text-zinc-200 font-medium">{course.lecturer || "Təyin olunmayıb"}</strong>
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-medium bg-zinc-800/80 text-zinc-200 px-3 py-1.5 rounded-xl border border-zinc-700/50 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              {course.time}
                            </span>
                                    <span className="text-xs bg-zinc-800/80 text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-700/50 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-purple-400" />
                                      {course.floor}-ci mərtəbə{course.room ? `, otaq ${course.room}` : ""}
                            </span>
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                    );
                  })}
                </div>
              </div>
          )}

          {step === "editor" && (
              <form onSubmit={handleSaveSession} className="space-y-6 animate-in fade-in duration-300">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <input
                      type="text"
                      value={sessionTitleInput}
                      onChange={(e) => setSessionTitleInput(e.target.value)}
                      className="text-lg font-semibold bg-transparent border-b border-zinc-700 text-white focus:border-indigo-500 outline-none pb-1.5 flex-1 max-w-sm transition-colors"
                      placeholder="Cədvəlin adı..."
                  />
                  <button
                      type="button"
                      onClick={() => setStep("cards")}
                      className="h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Geri Qayıt
                  </button>
                </div>

                <div className="space-y-3">
                  {activeCourses.map((course, index) => (
                      <div key={course.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-xl flex flex-col lg:flex-row items-start lg:items-center gap-4 backdrop-blur-md">
                        <div className="flex items-center gap-3 w-full lg:w-60">
                          <span className="text-xs font-mono font-bold text-zinc-500 w-5">{index + 1}.</span>
                          <span className="text-sm font-semibold text-zinc-200 truncate" title={course.name}>
                      {course.name}
                    </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2.5 w-full lg:w-auto flex-1">
                          <select
                              value={course.day || 1}
                              onChange={(e) => handleCourseChange(index, "day", Number(e.target.value))}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            {DAY_OPTIONS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>

                          <input
                              type="time"
                              value={course.time}
                              onChange={(e) => handleCourseChange(index, "time", e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                          />

                          <select
                              value={course.floor ?? 1}
                              onChange={(e) => handleCourseChange(index, "floor", Number(e.target.value))}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            {FLOOR_OPTIONS.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>

                          <input
                              type="text"
                              placeholder="Otaq"
                              value={course.room}
                              onChange={(e) => handleCourseChange(index, "room", e.target.value)}
                              className="w-full lg:w-20 h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>

                        <div className="w-full lg:w-48">
                          <input
                              type="text"
                              placeholder="Müəllim / Lektor"
                              value={course.lecturer}
                              onChange={(e) => handleCourseChange(index, "lecturer", e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>
                  ))}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Cədvəli Yadda Saxla
                </button>
              </form>
          )}

        </main>
      </div>
  );
}