"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

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
  { value: 1, label: "1-ci gün" },
  { value: 2, label: "2-ci gün" },
  { value: 3, label: "3-cü gün" },
  { value: 4, label: "4-cü gün" },
  { value: 5, label: "5-ci gün" },
  { value: 6, label: "6-cı gün" },
  { value: 7, label: "Bazar günü" },
];

const FLOOR_OPTIONS = Array.from({ length: 13 }, (_, i) => ({
  value: i,
  label: `${i}-ci mərtəbə`,
}));

// Sadə və effektiv Cihaz Fingerprint yaradıcısı
function getDeviceFingerprint(): string {
  let deviceId = localStorage.getItem("app_device_id");
  if (!deviceId) {
    const userAgent = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rawString = `${userAgent}-${screenRes}-${timezone}-${Math.random()}`;

    // Sadə hash (baza stringini unikal ID-yə çevirmək üçün)
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

  // 'cards' | 'editor'
  const [step, setStep] = useState<"cards" | "editor">("cards");

  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitleInput, setSessionTitleInput] = useState("Payız Semestri Cədvəli");

  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // Səhifə açıldıqda cihazı tanıyırıq və məlumatları çəkirik
  useEffect(() => {
    async function init() {
      const devId = getDeviceFingerprint();
      setDeviceId(devId);

      const { data: majorData } = await supabase.from("specialties").select("id, name");
      if (majorData) setMajorOptions(majorData);

      // Bu cihaza aid sessiyaları yüklə
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

  // Yeni cədvəl yaratmaq
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

  // Mövcud karta kliklədikdə
  async function handleOpenSession(session: SessionCard) {
    setActiveSessionId(session.id);
    setSelectedMajorId(session.specialty_id);
    setSessionTitleInput(session.session_title);
    setIsUpdateMode(true);
    await loadSubjectsForMajor(session.specialty_id, session.id);
  }

  // Fənləri və qeydləri yüklə
  async function loadSubjectsForMajor(majorId: number, sessionId: string | null) {
    const { data: subjectsData, error: subError } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .eq("specialty_id", majorId);

    if (subError || !subjectsData) {
      alert("Fənlər tapılmadı!");
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
  }

  function handleCourseChange(index: number, field: keyof Course, value: any) {
    const updated = [...activeCourses];
    updated[index] = { ...updated[index], [field]: value };
    setActiveCourses(updated);
  }

  // Cədvəli Yadda Saxla / Yenilə
  async function handleSaveSession(e: FormEvent) {
    e.preventDefault();
    if (!selectedMajorId) return;

    let targetSessionId = activeSessionId;

    if (!isUpdateMode || !targetSessionId) {
      // Yeni sessiya aç
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
        return;
      }
      targetSessionId = newSession.id;
    } else {
      // Mövcud sessiyanın başlığını yenilə və köhnə fənləri təmizlə
      await supabase
          .from("student_sessions")
          .update({ session_title: sessionTitleInput.trim() })
          .eq("id", targetSessionId);

      await supabase.from("student_schedules").delete().eq("session_id", targetSessionId);
    }

    // Fənləri yaz
    const schedulesToInsert = activeCourses.map((course) => {
      const dayLabel = DAY_OPTIONS.find((d) => d.value === course.day)?.label || "1-ci gün";
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
      return;
    }

    alert("Cədvəl uğurla yadda saxlanıldı!");
    setStep("cards");
    fetchSessions(deviceId);
  }

  return (
      <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
        <main className="flex w-full max-w-4xl flex-col py-16 px-6">

          {/* KARTLAR EKRANI */}
          {step === "cards" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 hidden">
                  <div>
                    <h2 className="text-xl font-bold text-black dark:text-zinc-50 hidden">Mənim Cədvəl Kartlarım</h2>
                    <p className="text-xs text-zinc-500 mt-1 hidden">Bu cihazda qeydə alınmış cədvəlləriniz avtomatik idarə olunur.</p>
                  </div>
                  <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded font-mono hidden">
                ID: {deviceId.slice(0, 10)}...
              </span>
                </div>

                {/* Yeni Cədvəl Kartı Yaratmaq */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-zinc-500 mb-1">Yeni Cədvəl üçün İxtisas Seçin</label>
                    <select
                        value={selectedMajorId || ""}
                        onChange={(e) => setSelectedMajorId(Number(e.target.value))}
                        className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-black dark:text-white outline-none"
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
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium whitespace-nowrap"
                  >
                   Cədvəl Qur
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span>Keçmiş</span>
                  </div>
                  <br/>
                  {sessions.map((session) => (
                      <div
                          key={session.id}
                          onClick={() => handleOpenSession(session)}
                          className="cursor-pointer bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-500 transition-all flex flex-col justify-between gap-4"
                      >
                        <div>
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-mono">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                          <h3 className="text-base font-semibold text-black dark:text-zinc-50 mt-2">
                            {session.session_title}
                          </h3>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                    Cədvələ bax / Redaktə et &rarr;
                  </span>
                      </div>
                  ))}
                </div>

                {sessions.length === 0 && (
                    <div className="text-center py-12 text-zinc-400 text-sm border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                      Bu cihazda hələ heç bir cədvəl kartı yoxdur. Yuxarıdan ixtisas seçib ilk kartınızı yaradın.
                    </div>
                )}
              </div>
          )}

          {/* REDAKTOR / CƏDVƏL EKRANI */}
          {step === "editor" && (
              <form onSubmit={handleSaveSession} className="flex flex-col gap-6 bg-white dark:bg-zinc-950 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Kartın Başlığı</label>
                    <input
                        type="text"
                        value={sessionTitleInput}
                        onChange={(e) => setSessionTitleInput(e.target.value)}
                        className="text-lg font-bold bg-transparent border-b border-dashed border-zinc-400 text-black dark:text-white outline-none pb-1"
                    />
                  </div>
                  <button
                      type="button"
                      onClick={() => setStep("cards")}
                      className="text-xs border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    &larr; Kartlara Qayıt
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {activeCourses.map((course, index) => (
                      <div key={course.id} className="flex flex-wrap items-center gap-3 p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <span className="text-xs font-bold text-zinc-400 w-5">{index + 1}.</span>
                        <div className="w-full sm:w-36 font-medium text-sm text-black dark:text-zinc-50">{course.name}</div>

                        <select
                            value={course.day || 1}
                            onChange={(e) => handleCourseChange(index, "day", Number(e.target.value))}
                            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1.5 text-xs text-black dark:text-zinc-50"
                        >
                          {DAY_OPTIONS.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>

                        <input
                            type="time"
                            value={course.time}
                            onChange={(e) => handleCourseChange(index, "time", e.target.value)}
                            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1.5 text-xs text-black dark:text-zinc-50"
                        />

                        <select
                            value={course.floor ?? 1}
                            onChange={(e) => handleCourseChange(index, "floor", Number(e.target.value))}
                            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1.5 text-xs text-black dark:text-zinc-50"
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
                            className="w-16 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1.5 text-xs text-black dark:text-zinc-50"
                        />

                        <input
                            type="text"
                            placeholder="Lektor"
                            value={course.lecturer}
                            onChange={(e) => handleCourseChange(index, "lecturer", e.target.value)}
                            className="flex-1 min-w-[100px] rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1.5 text-xs text-black dark:text-zinc-50"
                        />
                      </div>
                  ))}
                </div>

                <button type="submit" className="w-full bg-black text-white dark:bg-zinc-50 dark:text-black py-2.5 rounded text-sm font-medium mt-2">
                  Cədvəl Kartını Yadda Saxla
                </button>
              </form>
          )}

        </main>
      </div>
  );
}