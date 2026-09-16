"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Specialty = {
    id: number;
    name: string;
};

type Lecturer = {
    id: number;
    lecturer_name: string;
};

type SubjectWithLecturers = {
    subjectId: number;
    subjectName: string;
    lecturers: Lecturer[];
};

export default function AdminLecturerPanel() {
    const [specialties, setSpecialties] = useState<Specialty[]>([]);
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);
    const [dataList, setDataList] = useState<SubjectWithLecturers[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputValues, setInputValues] = useState<{ [key: number]: string }>({});

    useEffect(() => {
        async function fetchSpecialties() {
            const { data, error } = await supabase.from("specialties").select("id, name").order("name");
            if (!error && data) {
                setSpecialties(data);
            }
        }
        fetchSpecialties();
    }, []);

    async function handleSpecialtyChange(specialtyId: number) {
        setSelectedSpecialtyId(specialtyId);
        if (!specialtyId) {
            setDataList([]);
            return;
        }

        setLoading(true);

        // 1. İxtisasa uyğun fənləri çəkirik
        const { data: subjects, error: subError } = await supabase
            .from("subjects")
            .select("id, subject_name")
            .eq("specialty_id", specialtyId)
            .order("subject_name");

        if (subError || !subjects) {
            setLoading(false);
            return;
        }

        // 2. Hər fənnin tövsiyə olunan lektorlarını çəkirik
        const mappedData: SubjectWithLecturers[] = [];
        for (const sub of subjects) {
            const { data: lecturers } = await supabase
                .from("recommended_lecturers")
                .select("id, lecturer_name")
                .eq("subject_id", sub.id);

            mappedData.push({
                subjectId: sub.id,
                subjectName: sub.subject_name,
                lecturers: lecturers || [],
            });
        }

        setDataList(mappedData);
        setLoading(false);
    }

    async function handleAddLecturer(subjectId: number) {
        const name = inputValues[subjectId]?.trim();
        if (!name) return;

        const { data, error } = await supabase
            .from("recommended_lecturers")
            .insert({ subject_id: subjectId, lecturer_name: name })
            .select("id, lecturer_name")
            .single();

        if (!error && data) {
            setDataList((prev) =>
                prev.map((item) =>
                    item.subjectId === subjectId
                        ? { ...item, lecturers: [...item.lecturers, data] }
                        : item
                )
            );
            setInputValues((prev) => ({ ...prev, [subjectId]: "" }));
        }
    }

    async function handleDeleteLecturer(lecturerId: number, subjectId: number) {
        const { error } = await supabase
            .from("recommended_lecturers")
            .delete()
            .eq("id", lecturerId);

        if (!error) {
            setDataList((prev) =>
                prev.map((item) =>
                    item.subjectId === subjectId
                        ? { ...item, lecturers: item.lecturers.filter((l) => l.id !== lecturerId) }
                        : item
                )
            );
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-12 font-sans text-zinc-900 dark:text-zinc-100">

            {/* Header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 mb-8">
                <h1 className="text-xl font-semibold tracking-tight">Fənlər Üzrə Lektor İdarəetməsi</h1>
                <p className="text-sm text-zinc-500 mt-1">İxtisas seçin və fənlərə uyğun tövsiyə olunan lektorları tənzimləyin.</p>
            </div>

            {/* Filter Section */}
            <div className="mb-8">
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                    İxtisas
                </label>
                <select
                    value={selectedSpecialtyId || ""}
                    onChange={(e) => handleSpecialtyChange(Number(e.target.value))}
                    className="w-full sm:w-80 h-10 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                >
                    <option value="">— İxtisas seçin —</option>
                    {specialties.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            {/* Content Table / List */}
            {loading ? (
                <div className="text-sm text-zinc-400 py-12 text-center">Yüklənir...</div>
            ) : selectedSpecialtyId ? (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {dataList.map((item) => (
                        <div key={item.subjectId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                            {/* Fənnin adı */}
                            <div className="w-full sm:w-1/3">
                                <span className="text-sm font-medium">{item.subjectName}</span>
                            </div>

                            {/* Lektorların siyahısı */}
                            <div className="flex-1 flex flex-wrap items-center gap-1.5">
                                {item.lecturers.map((lect) => (
                                    <span
                                        key={lect.id}
                                        className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded"
                                    >
                    {lect.lecturer_name}
                                        <button
                                            onClick={() => handleDeleteLecturer(lect.id, item.subjectId)}
                                            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 ml-0.5"
                                            title="Sil"
                                        >
                      ✕
                    </button>
                  </span>
                                ))}
                                {item.lecturers.length === 0 && (
                                    <span className="text-xs text-zinc-400 italic">Lektor əlavə olunmayıb</span>
                                )}
                            </div>

                            {/* Yeni lektor əlavə etmə formu */}
                            <div className="w-full sm:w-auto flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Lektorun adı..."
                                    value={inputValues[item.subjectId] || ""}
                                    onChange={(e) =>
                                        setInputValues({ ...inputValues, [item.subjectId]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleAddLecturer(item.subjectId);
                                    }}
                                    className="w-full sm:w-44 h-8 px-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                                />
                                <button
                                    onClick={() => handleAddLecturer(item.subjectId)}
                                    className="h-8 px-3 rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-colors whitespace-nowrap"
                                >
                                    Əlavə et
                                </button>
                            </div>

                        </div>
                    ))}

                    {dataList.length === 0 && (
                        <div className="p-12 text-center text-sm text-zinc-400">
                            Bu ixtisasa aid fənn tapılmadı.
                        </div>
                    )}
                </div>
            ) : (
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-sm text-zinc-400">
                    İdarə etmək üçün yuxarıdan ixtisas seçin.
                </div>
            )}

        </div>
    );
}