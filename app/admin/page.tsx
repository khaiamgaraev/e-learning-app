"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ArrowLeft, BookOpen, Sparkles, Building2 } from "lucide-react";
import Link from "next/link";

type Specialty = {
    id: number;
    name: string;
};

type Subject = {
    id: number;
    subject_name: string;
    specialty_id: number;
};

export default function AdminPage() {
    const [specialties, setSpecialties] = useState<Specialty[]>([]);
    const [newSpecialtyName, setNewSpecialtyName] = useState("");

    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);

    const [newSubjectName, setNewSubjectName] = useState("");
    const [newLecturerName, setNewLecturerName] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSpecialties();
    }, []);

    async function fetchSpecialties() {
        const { data } = await supabase.from("specialties").select("*").order("name");
        if (data) setSpecialties(data);
    }

    async function handleAddSpecialty(e: FormEvent) {
        e.preventDefault();
        if (!newSpecialtyName.trim()) return;

        setLoading(true);
        const { error } = await supabase.from("specialties").insert({ name: newSpecialtyName.trim() });
        if (error) {
            alert("Xəta: " + error.message);
        } else {
            setNewSpecialtyName("");
            fetchSpecialties();
        }
        setLoading(false);
    }

    async function handleSelectSpecialty(id: number) {
        setSelectedSpecialtyId(id);
        fetchSubjects(id);
    }

    async function fetchSubjects(specId: number) {
        const { data } = await supabase
            .from("subjects")
            .select("id, subject_name, specialty_id")
            .eq("specialty_id", specId);
        if (data) setSubjects(data);
    }

    async function handleAddSubject(e: FormEvent) {
        e.preventDefault();
        if (!selectedSpecialtyId || !newSubjectName.trim()) return;

        setLoading(true);
        // 1. Fənni əlavə et
        const { data: subData, error: subError } = await supabase
            .from("subjects")
            .insert({
                specialty_id: selectedSpecialtyId,
                subject_name: newSubjectName.trim(),
            })
            .select()
            .single();

        if (subError || !subData) {
            alert("Fənn əlavə oluna bilmədi: " + subError?.message);
            setLoading(false);
            return;
        }

        // 2. Əgər lektor adı yazılıbsa, recommended_lecturers cədvəlinə əlavə et
        if (newLecturerName.trim()) {
            await supabase.from("recommended_lecturers").insert({
                subject_id: subData.id,
                lecturer_name: newLecturerName.trim(),
            });
        }

        setNewSubjectName("");
        setNewLecturerName("");
        fetchSubjects(selectedSpecialtyId);
        setLoading(false);
    }

    async function handleDeleteSubject(subjectId: number) {
        if (!confirm("Bu fənni silmək istədiyinizə əminsiniz?")) return;

        // Əvvəl əlaqəli lektorları silək (ForeignKey xətası çıxmaması üçün)
        await supabase.from("recommended_lecturers").delete().eq("subject_id", subjectId);
        await supabase.from("subjects").delete().eq("id", subjectId);

        if (selectedSpecialtyId) fetchSubjects(selectedSpecialtyId);
    }

    return (
        <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased">

            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold tracking-tight">Admin Panel - İxtisas və Fənn İdarəetməsi</h1>
                            <p className="text-xs text-zinc-500">Yeni ixtisaslar və fənlər əlavə edin</p>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="h-9 px-4 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Əsas Səhifəyə qayıt
                    </Link>
                </div>
            </header>

            {/* Main Container */}
            <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Sol sütun: İxtisaslar */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-500" /> Yeni İxtisas Əlavə Et
                        </h2>
                        <form onSubmit={handleAddSpecialty} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Məsələn: İnformatika müəllimliyi"
                                value={newSpecialtyName}
                                onChange={(e) => setNewSpecialtyName(e.target.value)}
                                className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-9 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                <Plus className="w-3.5 h-3.5" /> İxtisas Yarat
                            </button>
                        </form>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Mövcud İxtisaslar</h3>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                            {specialties.map((spec) => (
                                <button
                                    key={spec.id}
                                    onClick={() => handleSelectSpecialty(spec.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                                        selectedSpecialtyId === spec.id
                                            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                    }`}
                                >
                                    <span className="truncate">{spec.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sağ sütun: Seçilmiş ixtisasa aid fənlər */}
                <div className="md:col-span-2 space-y-6">
                    {selectedSpecialtyId ? (
                        <>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
                                <h2 className="text-sm font-semibold flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-500" /> Seçilmiş İxtisasa Fənn və Lektor Əlavə Et
                                </h2>
                                <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Fənnin adı (məs: Süni İntellekt)"
                                        value={newSubjectName}
                                        onChange={(e) => setNewSubjectName(e.target.value)}
                                        className="h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tövsiyə olunan lektor (istəyə bağlı)"
                                        value={newLecturerName}
                                        onChange={(e) => setNewLecturerName(e.target.value)}
                                        className="h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="sm:col-span-2 h-9 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Fənn Əlavə Et
                                    </button>
                                </form>
                            </div>

                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Bu İxtisasa Aid Fənlər Siyahısı</h3>
                                <div className="space-y-2">
                                    {subjects.map((sub) => (
                                        <div
                                            key={sub.id}
                                            className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs"
                                        >
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{sub.subject_name}</span>
                                            <button
                                                onClick={() => handleDeleteSubject(sub.id)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Fənni sil"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {subjects.length === 0 && (
                                        <p className="text-xs text-zinc-400 text-center py-6">Bu ixtisasa hələ heç bir fənn əlavə olunmayıb.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center p-12 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
                            <p className="text-sm text-zinc-400">Sol tərəfdən hər hansı bir ixtisas seçin və ya yeni ixtisas yaradın.</p>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}