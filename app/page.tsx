"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  Save,
  BookOpen,
  Sparkles
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

  const [step, setStep] = useState<"cards" | "editor">("cards");
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitleInput, setSessionTitleInput] = useState("Payız Semestri Cədvəli");

  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [loading, setLoading] = useState(false);

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

  function handleStartNewSchedule() {
    if (!selectedMajorId) {
      alert("Zəhmət olmasa ixtisas seçin!");
      return;
    }
    setActiveSessionId(null);
    setIsUpdateMode(false);
    setSessionTitleInput("Yeni Cədvəl Kartı");
    loadSubjectsForMajor(selectedMajorId, null);
  }

  async function handleOpenSession(session: SessionCard) {
    setActiveSessionId(session.id);
    setSelectedMajorId(session.specialty_id);
    setSessionTitleInput(session.session_title);
    setIsUpdateMode(true);
    await loadSubjectsForMajor(session.specialty_id, session.id);
  }

  async function loadSubjectsForMajor(majorId: number, sessionId: string | null) {
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

    setActiveCourses(coursesList);
    setStep("editor");
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
      <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight">Akademik Cədvəl İdarəetməsi</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Şəxsi dərslər və mühazirə cədvəli</p>
              </div>
            </div>
            {deviceId && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-md text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ID: {deviceId.slice(0, 12)}...
                </div>
            )}
          </div>
        </header>

        {/* Main Container */}
        <main className="max-w-5xl mx-auto px-6 py-10">

          {/* KARTLAR EKRANI */}
          {step === "cards" && (
              <div className="space-y-8">

                {/* Yeni Cədvəl Qrupu Bölməsi */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Yeni Cədvəl Kartı Yarat
                      </label>
                      <select
                          value={selectedMajorId || ""}
                          onChange={(e) => setSelectedMajorId(Number(e.target.value))}
                          className="w-full h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
                      >
                        <option value="">— İxtisas seçin —</option>
                        {majorOptions.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleStartNewSchedule}
                        disabled={loading}
                        className="w-full md:w-auto h-10 px-5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Cədvəl Qur
                    </button>
                  </div>
                </div>

                {/* Mövcud Kartlar Siyahısı */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Yadda Saxlanılan Cədvəllər</h2>
                    <span className="text-xs text-zinc-400 font-mono">{sessions.length} kart mövcuddur</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => handleOpenSession(session)}
                            className="group cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {session.session_title}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-medium text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                            <span>Cədvəli tənzimlə</span>
                            <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                    ))}
                  </div>

                  {sessions.length === 0 && (
                      <div className="text-center py-16 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
                        <BookOpen className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Aktiv cədvəl kartı tapılmadı.</p>
                        <p className="text-xs text-zinc-400 mt-1">Yuxarıdakı menyudan ixtisas seçərək başlaya bilərsiniz.</p>
                      </div>
                  )}
                </div>

              </div>
          )}

          {/* REDAKTOR EKRANI */}
          {step === "editor" && (
              <form onSubmit={handleSaveSession} className="space-y-6">

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="w-full sm:w-auto flex-1 space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Kartın Başlığı</label>
                    <input
                        type="text"
                        value={sessionTitleInput}
                        onChange={(e) => setSessionTitleInput(e.target.value)}
                        className="w-full max-w-md text-lg font-bold bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 text-zinc-900 dark:text-zinc-50 outline-none pb-1 transition-colors"
                    />
                  </div>
                  <button
                      type="button"
                      onClick={() => setStep("cards")}
                      className="h-9 px-4 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Geri qayıt
                  </button>
                </div>

                <div className="space-y-3">
                  {activeCourses.map((course, index) => (
                      <div
                          key={course.id}
                          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center gap-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                      >
                        <div className="flex items-center gap-3 w-full lg:w-64">
                          <span className="text-xs font-mono font-bold text-zinc-400 w-5">{index + 1}.</span>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={course.name}>
                      {course.name}
                    </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full lg:w-auto flex-1">
                          <div className="relative">
                            <select
                                value={course.day || 1}
                                onChange={(e) => handleCourseChange(index, "day", Number(e.target.value))}
                                className="w-full h-9 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            >
                              {DAY_OPTIONS.map((d) => (
                                  <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="relative">
                            <input
                                type="time"
                                value={course.time}
                                onChange={(e) => handleCourseChange(index, "time", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </div>

                          <div className="relative">
                            <select
                                value={course.floor ?? 1}
                                onChange={(e) => handleCourseChange(index, "floor", Number(e.target.value))}
                                className="w-full h-9 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            >
                              {FLOOR_OPTIONS.map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="relative">
                            <input
                                type="text"
                                placeholder="Otaq"
                                value={course.room}
                                onChange={(e) => handleCourseChange(index, "room", e.target.value)}
                                className="w-full lg:w-20 h-9 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </div>
                        </div>

                        <div className="w-full lg:w-56">
                          <input
                              type="text"
                              placeholder="Lektor"
                              value={course.lecturer}
                              onChange={(e) => handleCourseChange(index, "lecturer", e.target.value)}
                              className="w-full h-9 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                        </div>
                      </div>
                  ))}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Cədvəl Kartını Yadda Saxla
                </button>
              </form>
          )}

        </main>
      </div>
  );
}