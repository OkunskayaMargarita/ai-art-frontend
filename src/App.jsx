import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const initialForm = {
  character: "",
  style_name: "default",
  background: "",
  clothes: "",
  pose_mode: "free",
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

function App() {
  const [activeTab, setActiveTab] = useState("tags");
  const [form, setForm] = useState(initialForm);
  
  const [posePresets, setPosePresets] = useState([]);
  const [styles, setStyles] = useState([]);
  
  const [copiedPrompt, setCopiedPrompt] = useState(null);

  const [profiles, setProfiles] = useState({});
  const [selectedProfile, setSelectedProfile] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [actualSeed, setActualSeed] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);

  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [lastPositivePrompt, setLastPositivePrompt] = useState("");
  const [lastNegativePrompt, setLastNegativePrompt] = useState("");

  useEffect(() => {
    loadProfiles();
	loadPosePresets();
	loadStyles();
  }, []);
  
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
    console.error(
      "Не удалось загрузить пресеты поз:",
      requestError,
    );
  }
}

async function loadStyles() {
  try {
    const response = await fetch(`${API_URL}/styles`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Не удалось загрузить стили.",
      );
    }

    setStyles(result.styles || []);
  } catch (requestError) {
    console.error(
      "Не удалось загрузить стили:",
      requestError,
    );
  }
}

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
  
	function updateField(event) {
	  const { name, value, type, checked } = event.target;

	  setForm((previousForm) => ({
		...previousForm,
		[name]:
		  type === "checkbox"
			? checked
			: type === "number"
			  ? Number(value)
			  : value,
	  }));
	}

  async function generateImage() {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
			profile_name: selectedProfile,
			style_name: form.style_name,
			character: form.character,
			background: form.background,
			clothes: form.clothes,

			pose_mode: form.pose_mode,
			pose: form.pose_mode === "manual" ? form.pose : "",
			pose_preset_id:
			  form.pose_mode === "preset"
				? form.pose_preset_id
				: "",

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
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message);
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
  }
  
async function copyPrompt(text, promptType) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    setCopiedPrompt(promptType);

    setTimeout(() => {
      setCopiedPrompt((current) =>
        current === promptType ? null : current
      );
    }, 2000);
  } catch (copyError) {
    console.error("Не удалось скопировать промпт:", copyError);
  }
}

  const currentImage = images[currentImageIndex];

  return (
    <main className="app">

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

              {/* <TextField label="Стандартные теги" name="standard_tags" value={form.standard_tags} onChange={updateField} /> */}
			  {/* <TextField label="Негативные теги" name="negative_tags" value={form.negative_tags} onChange={updateField} /> */}
              <TextField label="Персонаж*" name="character" value={form.character} onChange={updateField} />
              <SelectField label="Стиль рисовки" name="style_name" value={form.style_name} onChange={updateField} options={styles.map((style) => ({value: style.id, label: style.name,}))}/>
			  <TextField label="Окружение" name="background" value={form.background} onChange={updateField} />
              <TextField label="Одежда" name="clothes" value={form.clothes} onChange={updateField} />
              <SelectField
			  label="Поза"
				  name="pose_mode"
				  value={form.pose_mode}
				  onChange={updateField}
				  options={[
					{ value: "free", label: "Без описания позы" },
					{ value: "automatic", label: "Случайная поза" },
					{ value: "preset", label: "Выбрать пресет" },
					{ value: "manual", label: "Своя поза" },
				  ]}
				/>

				{form.pose_mode === "preset" && (
				  <label className="field">
					<span>Пресет позы</span>
					<select
					  name="pose_preset_id"
					  value={form.pose_preset_id}
					  onChange={updateField}
					>
					  <option value="">Выберите позу</option>

					  {posePresets.map((preset) => (
						<option key={preset.id} value={preset.id}>
						  {preset.name || preset.id}
						</option>
					  ))}
					</select>
				  </label>
				)}

				{form.pose_mode === "manual" && (
				  <TextField
					label="Описание позы"
					name="pose"
					value={form.pose}
					onChange={updateField}
				  />
				)}
			  <TextField label="Дополнительные теги" name="extra_tags" value={form.extra_tags} onChange={updateField} />
			  <TextField label="Дополнительные негативные теги" name="user_negative" value={form.user_negative} onChange={updateField} />
            </section>
          )}

          {activeTab === "settings" && (
            <>
              <section className="panel-section">
                <h2>Основные настройки</h2>

                <div className="form-grid">
                  <NumberField label="Ширина" name="width" value={form.width} onChange={updateField} min={64} max={2048} />
                  <NumberField label="Высота" name="height" value={form.height} onChange={updateField} min={64} max={2048} />
                  <NumberField label="Steps" name="steps" value={form.steps} onChange={updateField} min={1} max={150} />
                  <NumberField label="CFG" name="cfg" value={form.cfg} onChange={updateField} min={1} max={30} step={0.5} />
                  <NumberField label="Seed" name="seed" value={form.seed} onChange={updateField} />

                  <NumberField label="Batch size" name="batch_size" value={form.batch_size} onChange={updateField} min={1} max={8} />
                  <NumberField label="Batch count" name="batch_count" value={form.batch_count} onChange={updateField} min={1} max={20} />
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

<details className="prompt-details" open>
  <summary>Итоговый промпт</summary>

  <div className="final-prompt">
<button
  type="button"
  className={`copy-prompt-button ${
    copiedPrompt === "positive" ? "copied" : ""
  }`}
  onClick={() => copyPrompt(lastPositivePrompt, "positive")}
  title={
    copiedPrompt === "positive"
      ? "Скопировано"
      : "Скопировать промпт"
  }
  aria-label="Скопировать промпт"
>
  {copiedPrompt === "positive" ? (
    <span className="check-icon">✓</span>
  ) : (
    <span className="copy-icon" />
  )}
</button>

    <div className="final-prompt-text">
      {lastPositivePrompt || "—"}
    </div>
  </div>
</details>

<details className="prompt-details" open>
  <summary>Итоговый негативный промпт</summary>

  <div className="final-prompt">
<button
  type="button"
  className={`copy-prompt-button ${
    copiedPrompt === "negative" ? "copied" : ""
  }`}
  onClick={() => copyPrompt(lastNegativePrompt, "negative")}
  title={
    copiedPrompt === "negative"
      ? "Скопировано"
      : "Скопировать негативный промпт"
  }
  aria-label="Скопировать негативный промпт"
>
  {copiedPrompt === "negative" ? (
    <span className="check-icon">✓</span>
  ) : (
    <span className="copy-icon" />
  )}
</button>

    <div className="final-prompt-text">
      {lastNegativePrompt || "—"}
    </div>
  </div>
</details>
			  </div>
			)}

          {currentImage && (
            <>
				<div className="image-navigation">
				  <a
					href={currentImage.image_url}
					download={currentImage.filename}
					target="_blank"
					rel="noreferrer"
				  >
					Открыть изображение
				  </a>
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

function NumberField({ label, name, value, onChange, min, max, step = 1 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" name={name} value={value} onChange={onChange} min={min} max={max} step={step} />
    </label>
  );
}

function SelectField({label,name,value,onChange,options,}) {
  return (
    <label className="field">
      <span>{label}</span>

      <select
        name={name}
        value={value}
        onChange={onChange}
      >
        {options.map((option) => {
          const optionValue =
            typeof option === "string"
              ? option
              : option.value;

          const optionLabel =
            typeof option === "string"
              ? option
              : option.label;

          return (
            <option
              value={optionValue}
              key={optionValue}
            >
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export default App;