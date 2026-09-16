"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  ArrowLeft,
  LayoutDashboard,
  Save,
  BookOpen,
  Edit3,
  Eye,
  CalendarDays,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X
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
    setSessionTitleInput("Yeni cədvəl");
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
            session_title: sessionTitleInput.trim() || "Cədvəl",
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
      <div className="min-h-screen bg-content1 text-foreground font-sans antialiased selection:bg-default-200">

        {/* Header - HeroUI Navigation Style */}
        <header className="sticky top-0 z-40 w-full border-b border-divider bg-background/70 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-normal capitalize">Akademik cədvəl</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10">

          {step === "cards" && (
              <div className="space-y-6">
                {/* Main Card - HeroUI Card Style */}
                <div className="rounded-2xl border border-divider bg-content1 p-6 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-default-500 uppercase tracking-wider">
                      İxtisas seçimi
                    </label>
                    <select
                        value={selectedMajorId || ""}
                        onChange={(e) => {
                          setSelectedMajorId(Number(e.target.value));
                          setShowRecommendations(false);
                        }}
                        className="w-full h-11 px-3 rounded-xl border border-default-200 bg-default-50 hover:border-default-400 focus:border-foreground focus:outline-none transition-colors text-sm"
                    >
                      <option value="">— İxtisas seçin —</option>
                      {majorOptions.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                        type="button"
                        onClick={handleStartNewSchedule}
                        disabled={loading}
                        className="w-full sm:flex-1 h-11 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Cədvəl qur
                    </button>

                    <button
                        type="button"
                        onClick={handleFetchRecommendations}
                        disabled={loading}
                        className="w-full sm:flex-1 h-11 rounded-xl border border-default-200 hover:bg-default-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-warning" /> Lektor tövsiyəsi al
                    </button>
                  </div>
                </div>

                {/* Recommendations Section */}
                {showRecommendations && (
                    <div className="rounded-2xl border border-divider bg-content1 overflow-hidden shadow-sm">
                      <div className="bg-default-100 px-6 py-4 border-b border-divider flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-default-600">
                    Tövsiyə olunan lektorlar
                  </span>
                        <button
                            onClick={() => setShowRecommendations(false)}
                            className="text-xs text-default-500 hover:text-foreground transition-colors"
                        >
                          Bağla
                        </button>
                      </div>

                      <div className="divide-y divide-divider">
                        {recommendationsList.map((rec, index) => (
                            <div key={index} className="p-5 space-y-2">
                              <h4 className="text-sm font-semibold">{rec.subject_name}</h4>
                              {rec.lecturer_names.length > 0 ? (
                                  <ol className="list-decimal list-inside space-y-1 text-xs text-default-600">
                                    {rec.lecturer_names.map((name, i) => (
                                        <li key={i}>{name}</li>
                                    ))}
                                  </ol>
                              ) : (
                                  <p className="text-xs text-default-400">Tövsiyə yoxdur</p>
                              )}
                            </div>
                        ))}

                        {recommendationsList.length === 0 && (
                            <div className="p-8 text-center text-xs text-default-400">
                              Məlumat tapılmadı.
                            </div>
                        )}
                      </div>
                    </div>
                )}

                {/* History Section */}
                <div className="space-y-4 pt-4">
                  <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-2 text-xs font-semibold text-default-500 uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <History className="w-4 h-4" />
                    <span>Cədvəllər ({sessions.length})</span>
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showHistory && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="group relative rounded-2xl border border-divider bg-content1 p-5 shadow-sm hover:border-default-400 transition-all flex flex-col justify-between gap-4"
                            >
                              <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="absolute top-4 right-4 p-1.5 rounded-lg text-default-400 hover:text-danger hover:bg-default-100 transition-colors"
                                  title="Sil"
                              >
                                <X className="w-4 h-4" />
                              </button>

                              <div className="space-y-1.5 pr-8">
                        <span className="text-[10px] font-mono bg-default-100 text-default-600 px-2 py-0.5 rounded-md">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                                <h3 className="text-sm font-semibold">{session.session_title}</h3>
                              </div>

                              <div className="flex items-center gap-2 pt-3 border-t border-divider">
                                <button
                                    onClick={() => handleOpenSession(session, "viewer")}
                                    className="flex-1 h-9 rounded-xl bg-foreground text-background text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Baxış
                                </button>
                                <button
                                    onClick={() => handleOpenSession(session, "editor")}
                                    className="h-9 px-4 rounded-xl border border-default-200 hover:bg-default-100 text-xs font-medium transition-colors"
                                >
                                  Redaktə
                                </button>
                              </div>
                            </div>
                        ))}

                        {sessions.length === 0 && (
                            <div className="col-span-full rounded-2xl border border-dashed border-divider p-12 text-center text-xs text-default-400">
                              Heç bir cədvəl mövcud deyil.
                            </div>
                        )}
                      </div>
                  )}
                </div>
              </div>
          )}

          {step === "viewer" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-divider bg-content1 p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-default-400 uppercase tracking-wider">Cədvəl baxışı</span>
                    <h2 className="text-lg font-semibold">{sessionTitleInput}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleOpenSession({ id: activeSessionId!, session_title: sessionTitleInput, specialty_id: selectedMajorId!, created_at: "" }, "editor")}
                        className="h-9 px-4 rounded-xl border border-default-200 hover:bg-default-100 text-xs font-medium transition-colors"
                    >
                      Dəyişiklik et
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep("cards")}
                        className="h-9 px-4 rounded-xl border border-default-200 hover:bg-default-100 text-xs font-medium transition-colors flex items-center gap-1.5"
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
                        <div key={dayObj.value} className="rounded-2xl border border-divider bg-content1 overflow-hidden shadow-sm">
                          <div className="bg-default-100 px-6 py-3.5 border-b border-divider flex items-center justify-between">
                      <span className="text-xs font-semibold text-default-600 uppercase tracking-wider flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-default-500" />
                        {dayObj.label}
                      </span>
                            <span className="text-[10px] font-mono bg-default-200 px-2 py-0.5 rounded-full text-default-700">
                        {dayCourses.length} dərs
                      </span>
                          </div>

                          <div className="divide-y divide-divider">
                            {dayCourses.map((course) => (
                                <div key={course.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-default-50 transition-colors">
                                  <div className="space-y-1">
                                    <span className="text-sm font-semibold">{course.name}</span>
                                    <p className="text-xs text-default-500">
                                      Müəllim: <strong className="text-default-700 font-medium">{course.lecturer || "Təyin olunmayıb"}</strong>
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold bg-default-100 px-2.5 py-1 rounded-lg">
                              {course.time}
                            </span>
                                    <span className="text-xs bg-default-100 text-default-600 px-2.5 py-1 rounded-lg">
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
              <form onSubmit={handleSaveSession} className="space-y-6">
                <div className="rounded-2xl border border-divider bg-content1 p-6 shadow-sm flex items-center justify-between gap-4">
                  <input
                      type="text"
                      value={sessionTitleInput}
                      onChange={(e) => setSessionTitleInput(e.target.value)}
                      className="text-lg font-semibold bg-transparent border-b border-default-300 focus:border-foreground outline-none pb-1 flex-1 max-w-sm transition-colors"
                  />
                  <button
                      type="button"
                      onClick={() => setStep("cards")}
                      className="h-9 px-4 rounded-xl border border-default-200 hover:bg-default-100 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Geri qayıt
                  </button>
                </div>

                <div className="space-y-3">
                  {activeCourses.map((course, index) => (
                      <div key={course.id} className="rounded-2xl border border-divider bg-content1 p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center gap-4">
                        <div className="flex items-center gap-3 w-full lg:w-56">
                          <span className="text-xs font-mono font-bold text-default-400 w-5">{index + 1}.</span>
                          <span className="text-sm font-semibold truncate" title={course.name}>
                      {course.name}
                    </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full lg:w-auto flex-1">
                          <select
                              value={course.day || 1}
                              onChange={(e) => handleCourseChange(index, "day", Number(e.target.value))}
                              className="w-full h-9 px-2.5 rounded-xl border border-default-200 bg-default-50 text-xs font-medium focus:outline-none focus:border-foreground"
                          >
                            {DAY_OPTIONS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>

                          <input
                              type="time"
                              value={course.time}
                              onChange={(e) => handleCourseChange(index, "time", e.target.value)}
                              className="w-full h-9 px-2.5 rounded-xl border border-default-200 bg-default-50 text-xs font-medium focus:outline-none focus:border-foreground"
                          />

                          <select
                              value={course.floor ?? 1}
                              onChange={(e) => handleCourseChange(index, "floor", Number(e.target.value))}
                              className="w-full h-9 px-2.5 rounded-xl border border-default-200 bg-default-50 text-xs font-medium focus:outline-none focus:border-foreground"
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
                              className="w-full lg:w-20 h-9 px-2.5 rounded-xl border border-default-200 bg-default-50 text-xs font-medium focus:outline-none focus:border-foreground"
                          />
                        </div>

                        <div className="w-full lg:w-48">
                          <input
                              type="text"
                              placeholder="Lektor"
                              value={course.lecturer}
                              onChange={(e) => handleCourseChange(index, "lecturer", e.target.value)}
                              className="w-full h-9 px-2.5 rounded-xl border border-default-200 bg-default-50 text-xs font-medium focus:outline-none focus:border-foreground"
                          />
                        </div>
                      </div>
                  ))}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-foreground text-background font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Cədvəli yadda saxla
                </button>
              </form>
          )}

        </main>
      </div>
  );
}