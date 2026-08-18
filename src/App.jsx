import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const initialForm = {
  character: "",
  background: "",
  clothes: "",
  
  pose_mode: "automatic",
  
  pose: "",
  pose_preset_id: "",
  
  extra_tags: "",
  user_negative: "",
  
  width: 1024,
  height: 1024,
  steps: 10,
  cfg: 1,
  seed: -1,
  
  batch_size: 1,
  batch_count: 1,
  
  sampler_name: "er_sde",
  scheduler: "simple",
  clip_skip: 1,
  
  hires_enabled: false,
  hires_steps: 20,
  hires_scale: 1.5,
  hires_upscaler: "R-ESRGAN 4x+ Anime6B",
  
  auto_pipeline: false,
  use_character_reference: false,
};

const PROFILE_FIELDS = [
  "width",
  "height",
  "steps",
  "cfg",
  "batch_size",
  "batch_count",
  "sampler_name",
  "scheduler"
];

function App() {
  const [activeTab, setActiveTab] = useState("tags");
  const [form, setForm] = useState(initialForm);

  const [profiles, setProfiles] = useState({});
  const [selectedProfile, setSelectedProfile] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [actualSeed, setActualSeed] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);

  const [status, setStatus] = useState("Готово к генерации");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [lastPositivePrompt, setLastPositivePrompt] = useState("");
  const [lastNegativePrompt, setLastNegativePrompt] = useState("");
  
  const [posePresets, setPosePresets] = useState([]);
  const [poseStatus, setPoseStatus] = useState("");
  
  const [lastPoseResult, setLastPoseResult] = useState(null);

  useEffect(() => {
    loadProfiles();
	loadPosePresets();
  }, []);

async function loadProfiles() {
  try {
    const response = await fetch(`${API_URL}/profiles`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Не удалось загрузить профили.",
      );
    }

    const loadedProfiles = result.profiles || {};

    setProfiles(loadedProfiles);
    const firstProfile = Object.keys(loadedProfiles)[0] ?? "";
	setSelectedProfile(firstProfile);
	if (firstProfile) {
		applyProfileSettings(loadedProfiles[firstProfile]);
	}
  } catch (requestError) {
    console.error(requestError);
    setProfileStatus(requestError.message);
  }
}

async function loadPosePresets() {
  try {
    const response = await fetch(`${API_URL}/poses`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Не удалось загрузить пресеты поз.",
      );
    }

    setPosePresets(result.poses || []);
  } catch (requestError) {
    console.error(requestError);
    setPoseStatus(requestError.message);
  }
}

  function getCurrentProfileSettings() {
    const settings = {engine: "anima"};

    for (const fieldName of PROFILE_FIELDS) {
      settings[fieldName] = form[fieldName];
    }

    return settings;
  }

  function applyProfileSettings(settings) {
    if (!settings) {
      return;
    }

    setForm((previousForm) => ({
      ...previousForm,
      ...settings,
    }));
  }

  function changeProfile(event) {
    const profileName = event.target.value;
    setSelectedProfile(profileName);
    setProfileStatus("");

    if (profileName && profiles[profileName]) {
      applyProfileSettings(profiles[profileName]);
      setProfileStatus(`Профиль «${profileName}» загружен.`);
    }
  }

  async function saveCurrentProfile() {
    if (!selectedProfile) {
      await saveProfileAs();
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/profiles/${encodeURIComponent(selectedProfile)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(getCurrentProfileSettings()),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Не удалось сохранить профиль.");
      }

      setProfiles((previousProfiles) => ({
        ...previousProfiles,
        [selectedProfile]: result.settings,
      }));
      setProfileStatus(`Профиль «${selectedProfile}» сохранён.`);
    } catch (requestError) {
      console.error(requestError);
      setProfileStatus(requestError.message);
    }
  }

  async function saveProfileAs() {
    const profileName = window.prompt("Введите название нового профиля:");

    if (!profileName || !profileName.trim()) {
      return;
    }

    const cleanedName = profileName.trim();

    try {
      const response = await fetch(`${API_URL}/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanedName,
          settings: getCurrentProfileSettings(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Не удалось создать профиль.");
      }

      setProfiles((previousProfiles) => ({
        ...previousProfiles,
        [cleanedName]: result.settings,
      }));
      setSelectedProfile(cleanedName);
      setProfileStatus(`Профиль «${cleanedName}» создан.`);
    } catch (requestError) {
      console.error(requestError);
      setProfileStatus(requestError.message);
    }
  }

  async function deleteSelectedProfile() {
    if (!selectedProfile) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить профиль «${selectedProfile}»?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/profiles/${encodeURIComponent(selectedProfile)}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Не удалось удалить профиль.");
      }

      const nextProfiles = { ...profiles };
      delete nextProfiles[selectedProfile];

      const nextProfileName = Object.keys(nextProfiles)[0] || "";

      setProfiles(nextProfiles);
      setSelectedProfile(nextProfileName);
      setProfileStatus(`Профиль «${selectedProfile}» удалён.`);

      if (nextProfileName) {
        applyProfileSettings(nextProfiles[nextProfileName]);
      }
    } catch (requestError) {
      console.error(requestError);
      setProfileStatus(requestError.message);
    }
  }
  
	function updateField(event) {
	  const { name, value, type, checked } = event.target;

	  setForm((previousForm) => ({
		...previousForm,
		[name]:
		  type === "checkbox"
			? checked
			: type === "number"
			  ? value
			  : value,
	  }));
	}
	
	function finishNumberEdit(event) {
		const { name, value } = event.target;

		setForm((previousForm) => ({
			...previousForm,
			[name]:
				value === ""
					? 0
					: Number(value),
		}));
	}

  async function generateImage() {
    setIsGenerating(true);
    setError("");
    setStatus("Генерация изображения...");

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
			profile_name: selectedProfile,
			
			character: form.character,
			background: form.background,
			clothes: form.clothes,
			
			pose_mode: form.pose_mode,
			
			pose: form.pose_mode === "manual" ? form.pose : "",
			pose_preset_id: form.pose_mode === "preset" ? form.pose_preset_id : "",
			extra_tags: form.extra_tags,
			user_negative: form.user_negative,
			
			width: form.width,
			height: form.height,
			steps: form.steps,
			cfg: form.cfg,
			seed: form.seed,
			clip_skip: form.clip_skip,
			batch_size: form.batch_size,
			batch_count: form.batch_count,
			hires_enabled: form.hires_enabled,
			hires_steps: form.hires_steps,
			hires_scale: form.hires_scale,
			hires_upscaler: form.hires_upscaler,
		}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || `Ошибка backend: HTTP ${response.status}`,
        );
      }
	  
	  setLastPositivePrompt(result.positive_prompt)
	  setLastNegativePrompt(result.negative_prompt)

      setImages(result.images || []);
      setCurrentImageIndex(0);
      setActualSeed(result.actual_seed ?? null);
      setGenerationTime(result.generation_time_seconds ?? null);
      setStatus("Генерация завершена");
	  setLastPoseResult(result.pose_result || null);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message);
      setStatus("Ошибка генерации");
    } finally {
      setIsGenerating(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setImages([]);
    setCurrentImageIndex(0);
    setActualSeed(null);
    setGenerationTime(null);
	setLastPositivePrompt("");
	setLastNegativePrompt("");
    setError("");
	setLastPoseResult(null);
    setStatus("Настройки сброшены");
  }

  function showPreviousImage() {
    if (images.length < 2) return;

    setCurrentImageIndex((currentIndex) =>
      currentIndex > 0 ? currentIndex - 1 : images.length - 1,
    );
  }

  function showNextImage() {
    if (images.length < 2) return;

    setCurrentImageIndex((currentIndex) =>
      currentIndex < images.length - 1 ? currentIndex + 1 : 0,
    );
  }

  const currentImage = images[currentImageIndex];

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>AI Art Generator</h1>
          <p>Universal AI Image Generator</p>
        </div>

        <div className={`status ${isGenerating ? "status-active" : ""}`}>
          {status}
        </div>
      </header>

      <section className="profile-toolbar">
        <label className="profile-select">
          <span>Профиль</span>
          <select value={selectedProfile} onChange={changeProfile}>
            <option value="">Без профиля</option>
			{
				Object.keys(profiles).map((profileName) => (
				<option key={profileName} value={profileName}>
				{profileName}
				</option>
			))}
          </select>
        </label>

        <div className="profile-actions">
          <button type="button" onClick={saveCurrentProfile}>
            Сохранить
          </button>
          <button type="button" onClick={saveProfileAs}>
            Сохранить как
          </button>
          <button
            type="button"
            onClick={deleteSelectedProfile}
            disabled={!selectedProfile}
          >
            Удалить
          </button>
        </div>

        {profileStatus && (
  <div className="profile-message">
    {profileStatus}
  </div>
)}
      </section>

      <section className="workspace">
        <div className="controls-panel">
          <div className="tabs">
            <button
              type="button"
              className={
                activeTab === "tags"
                  ? "tab-button active"
                  : "tab-button"
              }
              onClick={() => setActiveTab("tags")}
            >
              Теги
            </button>

            <button
              type="button"
              className={
                activeTab === "settings"
                  ? "tab-button active"
                  : "tab-button"
              }
              onClick={() => setActiveTab("settings")}
            >
              Настройки
            </button>
          </div>

          {activeTab === "tags" && (
            <section className="panel-section">
              <h2>Теги</h2>
              <TextField label="Персонаж*" name="character" value={form.character} onChange={updateField} />
              <TextField label="Окружение" name="background" value={form.background} onChange={updateField} />
              <TextField label="Одежда" name="clothes" value={form.clothes} onChange={updateField} />
			  
			  <label className="field">
				  <span>Способ выбора позы</span>
				  <select name="pose_mode" value={form.pose_mode} onChange={updateField}>
					<option value="automatic"> Подобрать автоматически </option>
					<option value="preset"> Выбрать пресет </option>
					<option value="manual"> Описать вручную </option>
					<option value="free"> Не использовать описание позы </option>
				  </select>
			  </label>
			  
			  

			  <div className="pose-fields">
			  
			  {form.pose_mode === "preset" && (
				  <label className="field">
					<span>Найти пресет позы</span>

					<input
					  type="text"
					  list="pose-preset-options"
					  placeholder="Автоматически подобрать"
					  value={
						posePresets.find(
						  (posePreset) =>
							posePreset.id === form.pose_preset_id,
						)?.name || ""
					  }
					  onChange={(event) => {
						const matchedPose = posePresets.find(
						  (posePreset) =>
							posePreset.name === event.target.value,
						);

						setForm((previousForm) => ({
						  ...previousForm,
						  pose_preset_id: matchedPose?.id || "",
						}));
					  }}
					/>

					<datalist id="pose-preset-options">
					  {posePresets.map((posePreset) => (
						<option
						  key={posePreset.id}
						  value={posePreset.name}
						>
						  {posePreset.description}
						</option>
					  ))}
					</datalist>
				  </label>
			  )}

			{form.pose_mode === "manual" && (
			  <TextField
				label="Описать позу вручную"
				name="pose"
				value={form.pose}
				onChange={updateField}
			  />
			)}
			
			{form.pose_mode === "automatic" && (
				<p className="field-hint">
				Программа автоматически выберет подходящий пресет позы.
				</p>
			)}
			
			{form.pose_mode === "free" && (
				<p className="field-hint">
				В промпт не будет добавлено никаких указаний на позу.
				Нейросеть сама определит композицию изображения.
				</p>
			)}
			  
			</div>
			  <TextField label="Дополнительные теги" name="extra_tags" value={form.extra_tags} onChange={updateField} />
			  <TextField label="Дополнительные негативные теги" name="user_negative" value={form.user_negative} onChange={updateField} />
            </section>
          )}

          {activeTab === "settings" && (
            <>
              <section className="panel-section">
                <h2>Основные настройки</h2>

                <div className="form-grid">
                  <NumberField label="Ширина" name="width" value={form.width} onChange={updateField} onFinishEdit={finishNumberEdit} min={64} max={4096} />
                  <NumberField label="Высота" name="height" value={form.height} onChange={updateField} onFinishEdit={finishNumberEdit} min={64} max={4096} />
                  <NumberField label="Steps" name="steps" value={form.steps} onChange={updateField} min={1} max={150} />
                  <NumberField label="CFG" name="cfg" value={form.cfg} onChange={updateField} min={1} max={30} step={0.5} />
                  <NumberField label="Seed" name="seed" value={form.seed} onChange={updateField} />

                  <NumberField label="Batch size" name="batch_size" value={form.batch_size} onChange={updateField} min={1} max={8} />
                  <NumberField label="Batch count" name="batch_count" value={form.batch_count} onChange={updateField} min={1} max={20} />
                </div>

				<div className="settings-note">
				  Anima Turbo использует sampler er_sde и scheduler simple.
				</div>

              </section>
            </>
          )}

          <div className="button-row">
            <button type="button" className="primary-button" onClick={generateImage} disabled={isGenerating}>
              {isGenerating ? "Генерация..." : "Сгенерировать"}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm} disabled={isGenerating}>
              Сбросить
            </button>
          </div>

          {error && <div className="error-box">{error}</div>}
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <h2>Результат</h2>
			
            {images.length > 0 && (
              <span>
                {currentImageIndex + 1} / {images.length}
              </span>
            )}
          </div>

          <div className="image-frame">
            {isGenerating ? (
              <div className="placeholder">
                <div className="spinner" />
                <strong>Изображение генерируется</strong>
                <span>Это может занять некоторое время</span>
              </div>
            ) : currentImage ? (
              <img src={currentImage.image_url} alt="Сгенерированный результат" />
            ) : (
              <div className="placeholder">
                <strong>Здесь появится изображение</strong>
                <span>Заполните поля и нажмите «Сгенерировать»</span>
              </div>
            )}
          </div>
		  
		  	{(lastPositivePrompt || lastNegativePrompt) && (
			  <div className="prompt-preview">
				<h3>Параметры последней генерации</h3>

				{lastPositivePrompt && (
				  <details>
					<summary>Итоговый промпт</summary>
					<pre>{lastPositivePrompt}</pre>
				  </details>
				)}

				{lastNegativePrompt && (
				  <details>
					<summary>Итоговый негативный промпт</summary>
					<pre>{lastNegativePrompt}</pre>
				  </details>
				)}
				
				{lastPoseResult && (
				  <div className="pose-result">
					<strong>Использованная поза:</strong>{" "}

					{lastPoseResult.source === "manual"
					  ? "Ручное описание"
					  : lastPoseResult.preset_name}

					{lastPoseResult.source === "automatic" && (
					  <span> — выбрана автоматически</span>
					)}
				  </div>
				)}
			  </div>
			)}

          {currentImage && (
            <>
              <div className="image-navigation">
                <button type="button" onClick={showPreviousImage} disabled={images.length < 2}>
                  Предыдущее
                </button>
                <a href={currentImage.image_url} download={currentImage.filename} target="_blank" rel="noreferrer">
                  Открыть изображение
                </a>
                <button type="button" onClick={showNextImage} disabled={images.length < 2}>
                  Следующее
                </button>
              </div>

              <div className="result-info">
                <div><span>Seed</span><strong>{actualSeed}</strong></div>
                <div><span>Время</span><strong>{generationTime} сек.</strong></div>
                <div><span>Размер</span><strong>{form.width} × {form.height}</strong></div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function TextField({ label, name, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} value={value} onChange={onChange} rows={2} />
    </label>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  onFinishEdit,
  min,
  max,
  step = 1,
}) {
  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <label className="field">
      <span>{label}</span>

      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onFinishEdit}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default App;