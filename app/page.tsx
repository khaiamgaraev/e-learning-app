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
  const [sessionTitleInput, setSessionTitleInput] = useState("Payız Semestri Cədvəli");

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
      <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">

        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hidden">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <span className="text-sm font-medium tracking-tight">Akademik Cədvəl</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10">

          {step === "cards" && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    İxtisas Seçimi
                  </label>
                  <select
                      value={selectedMajorId || ""}
                      onChange={(e) => {
                        setSelectedMajorId(Number(e.target.value));
                        setShowRecommendations(false);
                      }}
                      className="w-full h-10 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  >
                    <option value="">— İxtisas seçin —</option>
                    {majorOptions.map((m) => (
                        <option key={m.id} value={m.id} className="bg-white dark:bg-zinc-900">{m.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                        type="button"
                        onClick={handleStartNewSchedule}
                        disabled={loading}
                        className="h-9 px-4 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Cədvəl Qur
                    </button>

                    <button
                        type="button"
                        onClick={handleFetchRecommendations}
                        disabled={loading}
                        className="h-9 px-4 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      Lektor tövsiyəsi alın
                    </button>
                  </div>
                </div>

                {showRecommendations && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded divide-y divide-zinc-200 dark:divide-zinc-800">
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Tövsiyə Olunan Lektorlar</span>
                        <button onClick={() => setShowRecommendations(false)} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Bağla</button>
                      </div>
                      {recommendationsList.map((rec, index) => (
                          <div key={index} className="p-4 space-y-2">
                            <h4 className="text-sm font-semibold">{rec.subject_name}</h4>
                            {rec.lecturer_names.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                                  {rec.lecturer_names.map((name, i) => (
                                      <li key={i}>{name}</li>
                                  ))}
                                </ol>
                            ) : (
                                <p className="text-xs text-zinc-400">Tövsiyə yoxdur</p>
                            )}
                          </div>
                      ))}
                      {recommendationsList.length === 0 && (
                          <div className="p-6 text-center text-xs text-zinc-400">Məlumat tapılmadı.</div>
                      )}
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Cədvəllər ({sessions.length})</span>
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showHistory && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="group relative border border-zinc-200 dark:border-zinc-800 rounded p-4 flex flex-col justify-between gap-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                            >
                              <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="absolute top-3 right-3 text-zinc-400 hover:text-red-500 transition-colors text-xs p-1"
                                  title="Sil"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>

                              <div className="space-y-1 pr-6">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                                <h3 className="text-sm font-medium">{session.session_title}</h3>
                              </div>

                              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={() => handleOpenSession(session, "viewer")}
                                    className="flex-1 h-8 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium"
                                >
                                  Bax
                                </button>
                                <button
                                    onClick={() => handleOpenSession(session, "editor")}
                                    className="h-8 px-3 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                >
                                  Redaktə
                                </button>
                              </div>
                            </div>
                        ))}

                        {sessions.length === 0 && (
                            <div className="col-span-full border border-dashed border-zinc-200 dark:border-zinc-800 rounded p-8 text-center text-xs text-zinc-400">
                              Cədvəl mövcud deyil.
                            </div>
                        )}
                      </div>
                  )}
                </div>
              </div>
          )}

          {step === "viewer" && (
              <div className="space-y-6">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Cədvəl</span>
                    <h2 className="text-base font-semibold">{sessionTitleInput}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleOpenSession({ id: activeSessionId!, session_title: sessionTitleInput, specialty_id: selectedMajorId!, created_at: "" }, "editor")}
                        className="h-8 px-3 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
                    >
                      Dəyiş
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep("cards")}
                        className="h-8 px-3 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
                    >
                      Geri
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {DAY_OPTIONS.map((dayObj) => {
                    const dayCourses = activeCourses.filter((c) => c.day === dayObj.value);
                    if (dayCourses.length === 0) return null;

                    return (
                        <div key={dayObj.value} className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
                          <div className="bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{dayObj.label}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{dayCourses.length} dərs</span>
                          </div>

                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {dayCourses.map((course) => (
                                <div key={course.id} className="p-4 flex items-center justify-between gap-4">
                                  <div className="space-y-0.5">
                                    <span className="text-sm font-medium">{course.name}</span>
                                    <p className="text-xs text-zinc-400">Müəllim: {course.lecturer || "Təyin olunmayıb"}</p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                                    <span>{course.time}</span>
                                    <span>•</span>
                                    <span>{course.floor}-ci mərtəbə{course.room ? `, ${course.room}` : ""}</span>
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
                <div className="border border-zinc-200 dark:border-zinc-800 rounded p-4 flex items-center justify-between gap-4">
                  <input
                      type="text"
                      value={sessionTitleInput}
                      onChange={(e) => setSessionTitleInput(e.target.value)}
                      className="text-base font-semibold bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 outline-none pb-0.5 flex-1 max-w-sm"
                  />
                  <button
                      type="button"
                      onClick={() => setStep("cards")}
                      className="h-8 px-3 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
                  >
                    Geri
                  </button>
                </div>

                <div className="space-y-2">
                  {activeCourses.map((course, index) => (
                      <div key={course.id} className="border border-zinc-200 dark:border-zinc-800 rounded p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <span className="text-xs font-mono text-zinc-400 w-5">{index + 1}.</span>
                        <span className="text-sm font-medium w-full sm:w-48 truncate">{course.name}</span>

                        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto flex-1">
                          <select
                              value={course.day || 1}
                              onChange={(e) => handleCourseChange(index, "day", Number(e.target.value))}
                              className="h-8 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                          >
                            {DAY_OPTIONS.map((d) => (
                                <option key={d.value} value={d.value} className="bg-white dark:bg-zinc-900">{d.label}</option>
                            ))}
                          </select>

                          <input
                              type="time"
                              value={course.time}
                              onChange={(e) => handleCourseChange(index, "time", e.target.value)}
                              className="h-8 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                          />

                          <select
                              value={course.floor ?? 1}
                              onChange={(e) => handleCourseChange(index, "floor", Number(e.target.value))}
                              className="h-8 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                          >
                            {FLOOR_OPTIONS.map((f) => (
                                <option key={f.value} value={f.value} className="bg-white dark:bg-zinc-900">{f.label}</option>
                            ))}
                          </select>

                          <input
                              type="text"
                              placeholder="Otaq"
                              value={course.room}
                              onChange={(e) => handleCourseChange(index, "room", e.target.value)}
                              className="h-8 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs w-full sm:w-16"
                          />
                        </div>

                        <input
                            type="text"
                            placeholder="Lektor"
                            value={course.lecturer}
                            onChange={(e) => handleCourseChange(index, "lecturer", e.target.value)}
                            className="h-8 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs w-full sm:w-40"
                        />
                      </div>
                  ))}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Yadda Saxla
                </button>
              </form>
          )}

        </main>
      </div>
  );
}