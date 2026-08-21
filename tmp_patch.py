
import sys

p = 'frontend/src/pages/Dashboard.js'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# Old parents list (exact string from file)
old = '''            {parents.length === 0 ? <EmptyState text="No parents added yet." /> : (
              <div className="grid sm:grid-cols-2 gap-4" data-testid="parents-list">
                {parents.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{p.name}</p>
                        <p className="text-sm text-ayana-muted">{p.relationship} · {LANG_LABELS[p.language]}</p>
                      {/* Language suggestion badge */}
                      {langSuggestions[p.id]?.suggested_language && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-accent/10 text-ayana-accent">
                            💡 Detected {langSuggestions[p.id].suggested_language === "te" ? "Telugu" : langSuggestions[p.id].suggested_language === "hi" ? "Hindi" : langSuggestions[p.id].suggested_language}
                          </span>
                          <button
                            onClick={async () => {
                              try {
                                await api.put(`/parents/${p.id}/language`, langSuggestions[p.id].suggested_language);
                                toast.success(`Language updated to ${langSuggestions[p.id].suggested_language === "te" ? "Telugu" : langSuggestions[p.id].suggested_language === "hi" ? "Hindi" : langSuggestions[p.id].suggested_language}.`);
                                load();
                              } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
                            }}
                            className="text-xs text-ayana-accent underline underline-offset-1 hover:text-ayana-accent-hover"
                            data-testid={`apply-lang-${p.id}`}
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                        <SendTestDialog parent={p} categories={categories}
                          trigger={<button data-testid={`send-test-${p.id}`} title="Send a check-in now" className="p-2 text-ayana-muted hover:text-ayana-whatsapp transition-colors"><Send className="w-4 h-4" /></button>} />
                        <ParentDialog parent={p} relationships={relationships} languages={languages} config={config} limits={limits} plan={plan} onSaved={load}
                          trigger={<button data-testid={`edit-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDialog onConfirm={async () => { await api.delete(`/parents/${p.id}`); toast.success("Parent removed."); load(); }}
                          trigger={<button data-testid={`delete-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-ayana-secondary">
                      <p className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5" /> {p.phone}</p>
                      <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {p.timezone}</p>
                      {p.preferred_name && (
                        <p className="text-xs text-ayana-muted italic">Called &ldquo;{p.preferred_name}&rdquo; in messages</p>
                      )}
                      {(p.medicine_list || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(p.medicine_list || []).map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ayana-alt border border-ayana-line text-ayana-secondary">
                              💊 {m.name}{m.dose ? ` ${m.dose}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}'''

if old not in c:
    print("ERROR: old string not found", file=sys.stderr)
    sys.exit(1)

# New parents list with inline schedules, nicknames, preferred_name, and ParentDialog schedules prop
new = '''            {parents.length === 0 ? <EmptyState text="No parents added yet." /> : (
              <div className="grid sm:grid-cols-2 gap-4" data-testid="parents-list">
                {parents.map((p) => {
                  const parentSchedule = schedules.find((s) => s.parent_id === p.id);
                  const activeSchedule = parentSchedule?.active ?? true;
                  return (
                  <div key={p.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{p.name}</p>
                        <p className="text-sm text-ayana-muted">{p.relationship} · {LANG_LABELS[p.language]}</p>
                        {/* Language suggestion badge */}
                        {langSuggestions[p.id]?.suggested_language && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-accent/10 text-ayana-accent">
                              💡 Detected {langSuggestions[p.id].suggested_language === "te" ? "Telugu" : langSuggestions[p.id].suggested_language === "hi" ? "Hindi" : langSuggestions[p.id].suggested_language}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  await api.put(`/parents/${p.id}/language`, langSuggestions[p.id].suggested_language);
                                  toast.success(`Language updated to ${langSuggestions[p.id].suggested_language === "te" ? "Telugu" : langSuggestions[p.id].suggested_language === "hi" ? "Hindi" : langSuggestions[p.id].suggested_language}.`);
                                  load();
                                } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
                              }}
                              className="text-xs text-ayana-accent underline underline-offset-1 hover:text-ayana-accent-hover"
                              data-testid={`apply-lang-${p.id}`}
                            >
                              Apply
                            </button>
                          </div>
                        )}
                        {/* Nicknames */}
                        {p.nicknames && p.nicknames.length > 0 && (
                          <p className="text-xs text-ayana-muted mt-0.5">Known as: {p.nicknames.join(", ")}</p>
                        )}
                        {/* Preferred name display */}
                        {p.preferred_name && (
                          <p className="text-xs text-ayana-muted italic">Called &ldquo;{p.preferred_name}&rdquo; in messages</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <SendTestDialog parent={p} categories={categories}
                          trigger={<button data-testid={`send-test-${p.id}`} title="Send a check-in now" className="p-2 text-ayana-muted hover:text-ayana-whatsapp transition-colors"><Send className="w-4 h-4" /></button>} />
                        <ParentDialog parent={p} relationships={relationships} languages={languages} config={config} limits={limits} plan={plan} schedules={schedules} onSaved={load}
                          trigger={<button data-testid={`edit-parent-${p.id}`} title="Edit parent and schedule" className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDialog onConfirm={async () => { await api.delete(`/parents/${p.id}`); toast.success("Parent removed."); load(); }}
                          trigger={<button data-testid={`delete-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-ayana-secondary">
                      <p className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5" /> {p.phone}</p>
                      <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {p.timezone}</p>
                      {/* Schedule info inline */}
                      {parentSchedule && parentSchedule.messages && parentSchedule.messages.length > 0 && (
                        <div className="mt-2 p-2.5 bg-ayana-alt/50 rounded-lg">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-ayana-muted">Daily check-ins</span>
                            <Switch
                              checked={activeSchedule}
                              data-testid={`toggle-schedule-${parentSchedule.id}`}
                              onCheckedChange={async (v) => {
                                await api.put(`/schedules/${parentSchedule.id}`, { parent_id: p.id, mode: parentSchedule.mode, messages: parentSchedule.messages, active: v });
                                load();
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {parentSchedule.messages.filter(m => m.type !== "reminder" && m.source !== "medicine_sync").map((m, i) => {
                              const Icon = CATEGORY_ICONS[catByKey[m.category]?.icon] || MessageCircle;
                              return (
                                <span key={i} className="inline-flex items-center gap-1 text-xs text-ayana-secondary">
                                  <Icon className="w-3 h-3 text-ayana-primary" /> {m.time} · {catByKey[m.category]?.label || m.category}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(p.medicine_list || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(p.medicine_list || []).map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ayana-alt border border-ayana-line text-ayana-secondary">
                              💊 {m.name}{m.dose ? ` ${m.dose}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}'''

c = c.replace(old, new)
print("Parents list updated with inline schedule info and nicknames")

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print("Saved")
