const categories = [
  { id: "acoustic", label: "Acoustic artifacts" },
  { id: "doppler", label: "Doppler artifacts" },
  { id: "transducer", label: "Transducer faults" },
  { id: "system", label: "System faults" },
  { id: "miscellaneous", label: "Miscellaneous" }
];

const artifacts = [
  {
    id: "reverberation",
    category: "acoustic",
    name: "Reverberation",
    what: "Occurs when the ultrasound beam reflects back and forth between reflectors.",
    physics: "The ultrasound pulse bounces back and forth between two highly reflective surfaces - this equal time interval results in a series of equally spaced echoes. Reverberation artifacts are common in areas where sound waves encounter multiple layers of tissue or air, for example, when imaging lung tissue.<br> Reverberation can also occur when the beam reflects off a very reflective surface and the transducer face itself, producing a series of echoes which manifest as bright, equally spaced lines.",
    reduce: ["Reduce the overall gain", "Reduce near field time-gain compensation", "Turn on harmonic imaging"],
    spotting: ["Repeated parallel lines with equal spacing.", "Echoes that fade with depth.", "When changing the probe angle, the pattern may shift or disappear."],
    keywords: "repeated lines parallel echoes comet tail ring down"
  },
  {
    id: "posterior-enhancement",
    category: "acoustic",
    name: "Posterior acoustic enhancement",
    what: "Structures that transmit sound very well produce brighter echoes.",
    physics: "For e.g: fluid filled structures, the attenuation coefficient will be much less than that of surrounding soft tissue. The time gain compensation will then overcompensate through this fluid-filled structure causing deeper tissues to be brighter.<br> These shadow artifact can be categorised into clean and dirty - with clean shadow manifesting as sharp, completely dark columns with distinct edges. Dirty shadows are hazier and grayer, containing reverberation lines due to scattered ultrasound waves. ",
    reduce: ["Adjust time gain compensation," , "Turn on spatial compounding to direct the sound waves from different angles", "Reduce overall 2D gain and increase the dynamic range to soften contrast between normal tissue and the enhanced area"  ],
    spotting: ["Look for brighter regions posterior to the fluid-filled/cystic area.", "Compare the region behind the structure with tissue at a similar depth beside it.", "Check that the finding persists in more than one view."],
    keywords: "bright posterior cyst fluid increased echogenicity"
  },
  {
    id: "shadowing",
    category: "acoustic",
    name: "Acoustic shadowing",
    what: "Structures which are highly attenuating produce dark regions (shadows) behind the structure.",
    physics: "Due to sound waves being very heavily absorbed by these structures, there is a reduction in signal behind the structure.",
    reduce: ["Change the scan plane so the beam angle bypasses the strongly attenuating structure", "Turn on spatial compounding to direct the sound waves from different angles", "Optimise time gain compensation" ],
    spotting: ["Look for a dark band extending deep to a bright reflector.", "The shadow may be clean and sharply defined or diffuse.", "Alter the insonation angle to see whether the shadow changes."],
    keywords: "dark behind stone calcification gas shadow"
  },
  {
    id: "mirror-image",
    category: "acoustic",
    name: "Mirror image",
    what: "When a highly reflective surface in the path of the primary beam creates a mirror image of an object",
    physics: "Mirror image artifacts occur when the transmitted pulse reflects off a highly reflective surface and changes direction before its return to the transducer. Because of the increased length of the ultrasound pulse journey, the ultrasound scanner misjudges the distance to the object and produces a duplicate image of the object past the reflective boundary.<br> Mirror image artifacts are often deemed 'friendly' or helpful artifacts for certain clinical scenarios, for example, when excluding pleural effusion.",
    reduce: ["Alter the angle of insonation - tilt or rotate the probe to change the angle of the beam relative to the reflective surface.", "Modify gain/TGC if the duplicate image is caused by excessive brightness", "Modify focal zone and scan depth to minimise likelihood of multiple unwanted reflections" ],
    spotting: ["Look for a duplication of a structure across a reflector in the image.", "The reflected image will be appear deeper within the body", "Check whether the structure which is reflected has a plausible anatomical location."],
    keywords: "duplicate diaphragm liver image reflected pleural effusion reflector "
  },
  {
    id: "refraction",
    category: "acoustic",
    name: "Refraction and edge shadowing",
    what: "Occurs when an ultrasound pulse hits an interface at a non-perpendicular angle, causing refraction, bending the beam from its original path.",
    physics: "Refraction occurs fur to the ultrasound beam having different speeds of beam propagation within different tissues. Scanners assume that reflected echoes will come from the a source directly in line with the transmitted sound pulse, however echoes generated from a refracted beam will be misplaced in the image.",
    reduce:["Rotate the angle of the probe so the ultrasound beam strikes the tissue boundary at a 90 degree angle",
    "Enable spatial compounding, as capturing frames from multiple angles will reduce refraction of the beam"],
    spotting: ["Look for duplication of a structure side-by-side", "A dark band which shows up at the edge of curved surfaces such as blood vessels or cysts."],
    keywords: "edge shadow lateral displacement bending curved refraction refracted"
  },
  {
    id: "anisotropy",
    category: "acoustic",
    name: "Anisotropy",
    what: "Darkening which occurs due to tissues reflecting sound waves back to the transducer based on the angle of incidence of the ultrasound pulses.",
    physics: " A high proportion of the ultrasound beam reflected back to the transducer is dependent on the probe being perpendicular - as the probe angle varies from 90 degree, the visibility of the region being imaged decreases.",
    reduce:["Rotate the angle of the probe so the ultrasound beam strikes the tissue boundary at a 90 degree angle",
    "Enable spatial compounding, as capturing frames from multiple angles will reduce refraction of the beam"],
  spotting: ["Look for reduction in the brightness of structures", "Could be an anisotropy artifact if tilting or rocking (heel-toe maneuver) the probe resolves this issue.", "Especially common when imaging musculoskeletal tissue."],
    keywords: "tendon dark angle probe tilt heel toe perpendicular"
  },
  {
    id: "aliasing",
    category: "doppler",
    name: "Aliasing",
    what: "A Doppler display wraps around when the measured velocity exceeds the system's sampling limit.",
    physics: "Pulsed Doppler samples returning echoes at a finite pulse repetition frequency. By the Nyquist limit, the maximum unambiguous Doppler shift is half that frequency. Larger shifts are displayed with the wrong direction or wrapped to the opposite side of the scale.",
    spotting: ["On colour Doppler, look for abrupt colour reversal within a vessel.", "On a spectrum, look for the waveform wrapping past the scale boundary.", "Increase the scale or pulse repetition frequency, or use a lower transmit frequency where appropriate."],
    keywords: "wrap around colour reversal nyquist velocity scale prf"
  },
  {
    id: "colour-blooming",
    category: "doppler",
    name: "Colour blooming",
    what: "Colour extends beyond the vessel or flow boundary, making the lumen appear larger than it is.",
    physics: "Excessive colour gain makes low-level noise visible around the true Doppler signal. The displayed colour therefore spills into adjacent tissue and obscures the actual vessel margins.",
    spotting: ["Look for colour spilling beyond the visible vessel wall.", "Reduce colour gain until background colour speckle just disappears.", "Reassess the vessel boundary in greyscale and with a smaller colour box."],
    keywords: "colour outside vessel spill gain bleed blooming"
  },
  {
    id: "spectral-broadening",
    category: "doppler",
    name: "Spectral broadening",
    what: "A Doppler spectrum occupies a wider range of velocities than a narrow laminar flow profile would suggest.",
    physics: "A range of velocities can be sampled across the beam and the vessel. Broadening is also increased by a large sample gate, poor angle correction, excessive gain or disturbed flow. Some broadening is normal; it is not by itself proof of disease.",
    spotting: ["Look for filling-in of the spectral window beneath the waveform.", "Check the sample gate size, Doppler angle and gain before interpreting.", "Correlate with the site, vessel geometry and the rest of the examination."],
    keywords: "spectral window filling turbulent velocity broad"
  },
  {
    id: "flash-artifact",
    category: "doppler",
    name: "Flash (motion) artefact",
    what: "A brief burst of colour Doppler signal caused by movement of tissue or the transducer rather than blood flow.",
    physics: "Moving tissue produces Doppler shifts. If the wall filter and motion rejection cannot remove these low-frequency shifts, the system displays them as colour flow.",
    spotting: ["Look for a broad, transient colour flash across tissue.", "The signal may follow probe movement, breathing or patient motion.", "Stabilise the probe and repeat the observation; true flow is usually more localised and repeatable."],
    keywords: "flash motion tissue movement probe colour"
  },
  {
    id: "colour-priority",
    category: "doppler",
    name: "Colour priority overwrite",
    what: "Colour Doppler replaces greyscale echoes in areas where the colour signal is given display priority.",
    physics: "The system assigns display priority to colour pixels over B-mode echoes. If priority is high, colour can mask tissue detail or make the vessel boundary appear to extend beyond its true margin.",
    spotting: ["Look for missing or obscured greyscale detail beneath the colour map.", "Reduce colour priority or gain and reassess the underlying B-mode image.", "Use a smaller colour region to reduce unnecessary overwrite."],
    keywords: "overwrite priority colour masks greyscale"
  },
  {
    id: "dead-element",
    category: "transducer",
    name: "Element dropout",
    what: "A vertical dark line which indicates a weak or failed piezoelectric element in the transducer",
    physics:"Element dropout can occur due to the cracking of the acoustic array inside the transducer head, damage to the lens or lens housing, including cracks or wear in the probe lens which allows fluid to enter, or aging electronics or old piezoelectric crystals.",
    reduce:["Do not continue using probe if there is significant dropout, it must be taken out of service and swapped for a working transducer"],
    spotting: ["Look for a vertical line or band on screen which remains regardless of probe position.", "Faint lines correspond to weak piezoelectric elements, dark lines mean dead elements", "Dragging a metal paper clip across the lens surface allows for identification of any breaks or gaps in the the bright reflection line which will move across the screen (paper-clip test)."],
    keywords: "vertical line band missing element probe transducer paperclip dark dead weak"
  },
  {
    id: "delamination",
    category: "transducer",
    name: "Delamination",
    what: "The separation of layers within the head of the ultrasound transducer, which makes the on-screen reverberation lines appear wavy or curved.",
    physics:"When the layers within the head of the transducer separate, a small gap filled with air is created, inducing an acoustic impedance mismatch causing the speed of sound to slow down. The scanner assumes this area is deeper than it actually is, causing the flat layers to appear warped.",
    reduce:["To reduce and prevent delamination of an ultrasound probe lens, follow manufacturer guidelines regarding cleaning and disinfection to avoid over-soaking and chemical degradation", "Avoid excessive mechanical stress", "If significant delamination is visible in the image or on the probe, the probe must be pulled from clinical service and sent to be repaired or replaced."],
    spotting: ["Look for nonuniformity of the reverberation lines", "Delamination will cause shadowing downstream of the reverberation region.","Delaminated probes also may have raised spots on the lens sense - but sometimes no physical damage is visible, especially in the early stages."],
    keywords: "cracked peeling lens delamination damaged probe dropout"
  },
  {
    id: "cable-intermittent",
    category: "transducer",
    name: "Intermittent cable or connector fault",
    what: "Internal wire damage in the probe's wiring harness causes flaws in the image.",
    physics: "Worn wires make and break contact with each other causing unwanted and unexpected electronic information to be displayed. Incorrect mapping can occur between the piezoelectric crystals and corresponding section on the monitor - if connector pins are bent or broken, a permanent dead zone can be present. In B-mode, the image can flash or drop out when the cable is moved or twisted.In Doppler mode, artifacts can look like unwanted colour flashes or vertical streaks.",
    reduce:["Avoid acute bending of the cable and prevent the ultrasound scanner cart wheels from trampling the cables", "Ensure connecter locking the probe to the system is properly engaged and eck the connector pins prior to insertion", "If cable or connector fault is identified, stop using the probe and repair/replace it"],
    spotting: ["Look for intermittent image loss or noise, or image flickering", "Check whether it occurs/shifts upon changing cable position - do not purposefully twist or strain the cable when checking", "Also gently flex the strain relief to check for visual changes - again, do not flex the strain relied excessively  "],
    keywords: "flicker cable connector intermittent noise wiring wire strain relief colour"
  },
  {
    id: "probe-noise",
    category: "transducer",
    name: "Electrical interference",
    what: "Noise or unwanted lines/bands appear in the image due to electrical interference affecting the probe signal.",
    physics: "If the electrical outlet the scanner is plugged into has poor grounding, that noise overrides the cable shielding and shows up on the scanner. Any microscopic break in the cable shielding can allow noise to leak through, or if there is improper scanner grounding. External electronic devices which produce electromagnetic or radiofrequency waves which can be conducted towards internal circuitry, inducing further noise.",
    reduce:["Move the ultrasound prove away from devices which could produce electromagnetic or radiofrequency interference",
    "Ensure noise-reduction filters, such as Speckle Reduction Imaging is turned on in the system presets", "If the noise has been isolated to the probe, it must be removed from clinical service and be repaired/replaced."],
    spotting: ["Look fuzzy, grainy haze across the image or horizontal/diagonal bands that move across the screen.", "If the ultrasound cart is moved and the artifact disappears, its a sign that it is interference localised to a specific area."],
    keywords: "electrical noise interference bands probe electromagnetic radiofrequency fuzzy grainy speckle cable"
  },
  {
    id: "range-ambiguity",
    category: "system",
    name: "Range ambiguity",
    what: "The ultrasound image shows a deep organ/structure much closer to the surface than it actually is.",
    physics: "Caused by a too high pulse repetition frequency so an echo from a deeper structure arrives after the next pulse has already been transmitted.",
    reduce:["Move the ultrasound prove away from devices which could produce electromagnetic or radiofrequency interference",
    "Ensure noise-reduction filters, such as Speckle Reduction Imaging is turned on in the system presets", "If the noise has been isolated to the probe, it must be removed from clinical service and be repaired/replaced."],
    spotting: ["Look for an organ appearing implausibly shallow in the body", "Structures appear to lack proper borders", "In Doppler imaging, what should be e.g. a deep blood vessel appears to be very close to the surface"],
    keywords: "wrong depth late echo pulse repetition frequency prf noisy cloudy shallow vessel bladder superficial"
  },
  {
    id: "side-lobes",
    category: "system",
    name: "Side-lobe artefact",
    what: "When the side axis beams (side-lobes) of an ultrasound beam reflect from a strong reflector outside the main beam axis.",
    physics: "The piezoelectric crystals in the transducer expand and contract to produce ultrasound beams on-axis, but due to expansion and contraction also occurring radially, side-lobe beams are produced. These reflect off off-axis boundaries and display echoes with false positioning.",
    reduce:["Switch to harmonic imaging - not using the fundamental frequencies reduces the divergence of the beam, reducing side-lobe production  ","Turn on Speckle Reduction Imaging to reduce noise ", "Increasing the number of focal zones - this narrows the beam at multiple depths"],
    spotting: ["Look for bright curvilinear lines or spots within structures that should be dark (anechoic) due to being  .", "The false echo may align with a strong reflector outside the region.", "Change the probe angle or position and check whether the echo moves or disappears."],
    keywords: "false echoes fluid cyst off axis side lobe divergence reflector"
  },
  {
    id: "grating-lobes",
    category: "system",
    name: "Grating-lobe artefact",
    what: "Off-axis ultrasonic beams produced by transducer element array spacing",
    physics: "If the distance between individual piezoelectric crystal elements (pitch) is equal to or greater than the wavelength of the ultrasound wave, the transducer undersamples the wavefront and the system can no longer distinguish between a wave returning from the centre one returning from a side angle.",
    reduce:["Switch to harmonic imaging - grating lobes do not have energy to produce harmonic frequencies, reducing these artifacts", "Adjust the focal zone to direct at or below the structure being imaged, minimising energy spread at this depth","Decrease time gain compensation at the depth of the structure being imaged"],
    spotting: ["Look for echoes within natural dark anechoic structures (for example, bladder or large cysts)]", "Moving the patient will not move the grating lobe artifact - it will stay fixed in the exact same spot on the screen.", "Rotating the probe will rapidly change the shape of the artifact if it is a true grating lobe artifact."],
    keywords: "array off-axis false echoes fluid grating lobes"
  },
  {
    id: "clutter",
    category: "system",
    name: "Clutter",
    what: "Unwanted echoes in the near-field region which reduce the visibility of actual tissue and anatomical structures.",
    physics: "Caused by motion from heart walls, vessels walls or the respiratory system which produce signals that can contaminate blood flow data - can also be caused by reverberations from the chest wall or rib/lung interface",
    reduce:["Enable harmonic imaging to remove clutter from side-lobes", "Change transducer angle and position to avoid reflection from moving structures", "Adjust pulse repetition frequency to remove the background haze and adjust number and position of focal zones"],
    spotting: ["Look for a hazy region close to the transducer", "True clutter artifacts vanish as the beam angle is altered."],
    keywords: "haze clutter motion noise transducer reverberation motion vibration"
  },
  {
    id: "persistence",
    category: "system",
    name: "Temporal persistence",
    what: "Motion blur that occurs when the temporal persistence setting is set too high",
    physics: "Temporal persistence is a feature which updates and averages consecutive ultrasound frames to reduce noise and speckle. However increasing the persistence setting too high it will produce a laggy, motion-blurred appearance.",
    reduce:["Decrease any persistence/frame-averaging settings", "Use low or zero persistence for fast-moving structures and higher for slow-moving to reduce background and speckle noise", "Can improve real-time temporal resolution by narrowing field of view or reducing image depth"],
    spotting: ["Look for structures usually fast moving, such as rapidly beating heart valves and vessel walls appearing sluggish or with residual ghosting", "In colour doppler mode high persistence setting makes old flow velocities merge with current ones causing the colour signals to mix into each other", "Look for reduced temporal resolution - laggy, stuttering images which look choppy."],
    keywords: "smoothing smear trailing frames motion laggy stutter slow "
  },
  {
    id: "speckle",
    category: "miscellaneous",
    name: "Speckle",
    what: "Grainy, 'salt-and-pepper' appearance due to the constructive and destructive interference of the ultrasound waves",
    physics: "When transmitted and received ultrasound waves bounce off of very very small structures inside tissues and overlap causing bright (constructive) and dark (destructive) spots.",
    reduce:["Turn on the Speckle Reduction Imaging (SRI) setting - this is a post processing filter which identifies regions of smooth tissue and applies a smoothing algorithm", "Turn on spatial compounding - steering an ultrasound beam from multiple angles instead of one cancels out speckle noise", "Turning on tissue harmonic imaging selects for higher frequency echoes which produces a crisper image and reduces speckle."],
    spotting: ["Look for a granular uniform static made of bright and dark dots inside what should a region of smooth tissue", "Changing the position or angle of the probe will move the artifact", "Can be differentiated from electronic/thermal noise due to being blended into tissue, whereas electronic/thermal noise will cause whole-screen static."],
    keywords: "grain granular texture interference tissue speckle salt pepper grainy static noise"
  },
  {
    id: "probe-pressure",
    category: "miscellaneous",
    name: "Probe pressure artefact",
    what: "Compression from the transducer changes the shape or position of soft tissues and may alter flow.",
    physics: "Pressure deforms compliant structures and can compress superficial veins or other vessels, changing their calibre and potentially reducing or stopping flow. It can also displace mobile contents.",
    spotting: ["Look for changes that appear as the probe is pressed or released.", "Use the minimum pressure needed for adequate contact and image quality.", "Compare with a light-touch view, especially when assessing superficial vessels."],
    keywords: "compression pressure vein collapse deformation probe"
  },
  {
    id: "motion-misregistration",
    category: "miscellaneous",
    name: "Motion misregistration",
    what: "Anatomy appears blurred, duplicated or displaced when the patient or probe moves during image acquisition.",
    physics: "The image is assembled from echoes acquired over time. Movement between scan lines or frames means the displayed lines no longer represent the same anatomical position.",
    spotting: ["Look for blurred or discontinuous boundaries and duplicated edges.", "Ask the patient to pause movement or breathing briefly when appropriate.", "Stabilise the probe and repeat the image."],
    keywords: "blur duplicate edges movement breathing patient"
  },
  {
    id: "gas",
    category: "miscellaneous",
    name: "Gas interference",
    what: "Gas limits visualisation of deeper structures by reflecting and scattering the ultrasound beam.",
    physics: "The large acoustic impedance difference at a gas–tissue interface causes strong reflection and scattering. Reverberation and dirty shadowing may further obscure structures beyond the gas.",
    spotting: ["Look for a bright, irregular interface with dirty shadowing or reverberation.", "Try a different acoustic window or patient position if appropriate.", "Document limits to visualisation rather than interpreting obscured anatomy as absent."],
    keywords: "bowel gas dirty shadowing reverberation obscured"
  },
  {
    id: "speed-error",
    category: "miscellaneous",
    name: "Propagation speed error",
    what: "A structure may appear at the wrong depth when sound travels through tissue at a speed different from the scanner's assumed average.",
    physics: "The scanner calculates depth using an assumed average sound speed of about 1540 m/s in soft tissue. If the actual path speed differs, echo travel time is converted to an inaccurate depth.",
    spotting: ["Look for unexpected displacement or distortion deep to tissues with different sound speeds.", "Check anatomy in another plane or from another acoustic window.", "Consider other causes of displacement before attributing it to a speed error."],
    keywords: "1540 speed depth displacement wrong position"
  }
];

const categorySelect = document.querySelector("#category-select");
const artifactSelect = document.querySelector("#artifact-select");
const details = document.querySelector("#artifact-details");
const searchInput = document.querySelector("#artifact-search");
const clearSearchButton = document.querySelector("#clear-search");
const searchResults = document.querySelector("#search-results");
const searchHint = document.querySelector("#search-hint");
const atlasCount = document.querySelector("#atlas-count");
const LOCAL_IMAGE_DATABASE = "ultrasound-artifact-atlas";
const LOCAL_IMAGE_STORE = "artifact-images";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
let localImageDatabasePromise;
let activeImageUrls = [];

function getCategoryLabel(categoryId) {
  return categories.find((category) => category.id === categoryId)?.label ?? "";
}

function renderCategories() {
  categorySelect.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.label}</option>`)
    .join("");
}

function renderArtifactOptions(selectedId) {
  const categoryArtifacts = artifacts.filter((artifact) => artifact.category === categorySelect.value);
  artifactSelect.innerHTML = categoryArtifacts
    .map((artifact) => `<option value="${artifact.id}">${artifact.name}</option>`)
    .join("");

  if (selectedId && categoryArtifacts.some((artifact) => artifact.id === selectedId)) {
    artifactSelect.value = selectedId;
  }

  renderArtifact();
}

function renderArtifact() {
  const artifact = artifacts.find((item) => item.id === artifactSelect.value);
  if (!artifact) {
    return;
  }

  activeImageUrls.forEach((url) => URL.revokeObjectURL(url));
  activeImageUrls = [];

  details.innerHTML = `
    <div class="artifact-heading">
      <p class="eyebrow">${getCategoryLabel(artifact.category)}</p>
      <h3>${artifact.name}</h3>
    </div>
    <div class="detail-grid">
      <section class="detail-card what-card" aria-labelledby="what-heading">
        <div class="what-copy">
          <h4 id="what-heading">What is it?</h4>
          <p>${artifact.what}</p>
        </div>
        <div class="primary-image-wrap">
          <p class="image-empty" id="primary-image-empty">No example image has been added yet.</p>
          <img id="primary-artifact-image" alt="${artifact.name} example image" hidden>
        </div>
        <div class="image-actions">
          <label class="file-input-label" for="artifact-image-input">Choose image files</label>
          <input id="artifact-image-input" class="image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          <div class="image-caption-fields">
            <label class="caption-label" for="image-caption">Caption for uploaded images <span>(optional)</span></label>
            <input id="image-caption" class="caption-input" type="text" maxlength="500" placeholder="Describe what the image demonstrates">
            <button id="upload-image-button" class="upload-button" type="button">Upload images</button>
          </div>
          <a id="gallery-link" class="gallery-link" href="#artifact-image-gallery" hidden>View image gallery</a>
          <p class="upload-instructions">Choose image files, add an optional caption, then select Upload images. The caption appears below the image in the gallery.</p>
          <p class="local-storage-note">Images are saved in this browser only. They are not uploaded to a server or shared with other users.</p>
          <p id="image-upload-status" class="upload-status" role="status" aria-live="polite"></p>
        </div>
      </section>
      <section class="detail-card" aria-labelledby="physics-heading">
        <h4 id="physics-heading">The physics behind it</h4>
        <p>${artifact.physics}</p>
      </section>
      <section class="detail-card spotting-card" aria-labelledby="spot-heading">
        <h4 id="spot-heading">Quick ways to spot it</h4>
        <ul>${artifact.spotting.map((point) => `<li>${point}</li>`).join("")}</ul>
      </section>
      <section class="detail-card reduce-card" aria-labelledby="reduce-heading">
        <h4 id="reduce-heading">Ways to reduce it</h4>
        <ul>${(artifact.reduce ?? []).map((point) => `<li>${point}</li>`).join("")}</ul>
      </section>
      <section id="artifact-image-gallery" class="image-gallery" aria-labelledby="gallery-heading" hidden>
        <h4 id="gallery-heading">Example image gallery</h4>
        <p class="gallery-hint">Scroll horizontally to browse this artefact’s images.</p>
        <div class="image-gallery-grid" id="image-gallery-grid" tabindex="0" aria-label="${artifact.name} example images"></div>
      </section>
    </div>
  `;
  setupLocalImageUpload(artifact);
  renderArtifactImages(artifact);
}

function setupLocalImageUpload(artifact) {
  const uploadButton = document.querySelector("#upload-image-button");
  const fileInput = document.querySelector("#artifact-image-input");
  const captionInput = document.querySelector("#image-caption");
  const uploadStatus = document.querySelector("#image-upload-status");
  let selectedFiles = [];

  const selectFiles = (files) => {
    selectedFiles = [...files];
    uploadStatus.textContent = selectedFiles.length
      ? `${selectedFiles.length} ${selectedFiles.length === 1 ? "image" : "images"} selected.`
      : "";
  };

  fileInput.addEventListener("change", () => {
    selectFiles(fileInput.files);
  });

  uploadButton.addEventListener("click", async () => {
    const files = selectedFiles;
    if (!files.length) {
      uploadStatus.textContent = "Choose one or more image files first.";
      return;
    }
    if (files.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      uploadStatus.textContent = "Choose JPEG, PNG or WebP images no larger than 6 MB each.";
      fileInput.value = "";
      return;
    }

    uploadButton.disabled = true;
    uploadStatus.textContent = `Saving ${files.length} ${files.length === 1 ? "image" : "images"} in this browser…`;
    let saved = 0;
    try {
      for (const file of files) {
        await saveLocalArtifactImage({
          id: `image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          artifactId: artifact.id,
          contentType: file.type,
          caption: captionInput.value.trim(),
          createdAt: Date.now(),
          blob: file
        });
        saved += 1;
      }
      captionInput.value = "";
      if (artifactSelect.value === artifact.id) {
        selectedFiles = [];
        fileInput.value = "";
        await renderArtifactImages(artifact);
        uploadStatus.textContent = `${saved} ${saved === 1 ? "image" : "images"} saved in this browser.`;
      }
    } catch (error) {
      if (artifactSelect.value === artifact.id) {
        if (saved) {
          await renderArtifactImages(artifact);
        }
        uploadStatus.textContent = saved
          ? `${saved} image${saved === 1 ? "" : "s"} saved, but the next image could not be saved: ${error.message}`
          : `Could not save images: ${error.message}`;
      }
    } finally {
      uploadButton.disabled = false;
    }
  });
}

function openLocalImageDatabase() {
  if (localImageDatabasePromise) {
    return localImageDatabasePromise;
  }
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support local image storage."));
  }

  localImageDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_IMAGE_DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_IMAGE_STORE)) {
        const store = database.createObjectStore(LOCAL_IMAGE_STORE, { keyPath: "id" });
        store.createIndex("artifactId", "artifactId", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      localImageDatabasePromise = null;
      reject(request.error ?? new Error("Could not open local image storage."));
    };
    request.onblocked = () => {
      localImageDatabasePromise = null;
      reject(new Error("Local image storage is busy in another atlas tab. Close the other tab and try again."));
    };
  });
  return localImageDatabasePromise;
}

async function getLocalArtifactImages(artifactId) {
  const database = await openLocalImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_IMAGE_STORE, "readonly");
    const request = transaction.objectStore(LOCAL_IMAGE_STORE).index("artifactId").getAll(artifactId);
    request.onsuccess = () => resolve(request.result.sort((first, second) => first.createdAt - second.createdAt));
    request.onerror = () => reject(request.error ?? new Error("Could not read saved images."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not read saved images."));
  });
}

async function saveLocalArtifactImage(image) {
  const database = await openLocalImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_IMAGE_STORE, "readwrite");
    transaction.objectStore(LOCAL_IMAGE_STORE).add(image);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the image in this browser."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save the image in this browser."));
  });
}

async function deleteLocalArtifactImage(imageId) {
  const database = await openLocalImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_IMAGE_STORE, "readwrite");
    transaction.objectStore(LOCAL_IMAGE_STORE).delete(imageId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the image."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not delete the image."));
  });
}

async function renderArtifactImages(artifact) {
  const gallerySection = document.querySelector("#artifact-image-gallery");
  const gallery = document.querySelector("#image-gallery-grid");
  const primaryImage = document.querySelector("#primary-artifact-image");
  const emptyMessage = document.querySelector("#primary-image-empty");
  const galleryLink = document.querySelector("#gallery-link");
  const uploadStatus = document.querySelector("#image-upload-status");

  activeImageUrls.forEach((url) => URL.revokeObjectURL(url));
  activeImageUrls = [];
  gallery.replaceChildren();
  gallerySection.hidden = true;
  galleryLink.hidden = true;
  primaryImage.hidden = true;
  emptyMessage.hidden = false;

  try {
    const images = await getLocalArtifactImages(artifact.id);
    if (artifactSelect.value !== artifact.id) {
      return;
    }

    if (images.length) {
      const firstImage = images[0];
      primaryImage.src = URL.createObjectURL(firstImage.blob);
      activeImageUrls.push(primaryImage.src);
      primaryImage.alt = firstImage.caption || `${artifact.name} example image`;
      primaryImage.hidden = false;
      emptyMessage.hidden = true;
      gallerySection.hidden = false;
      galleryLink.hidden = false;
      galleryLink.textContent = `View image gallery (${images.length})`;

      images.forEach((image, index) => {
        const figure = document.createElement("figure");
        figure.className = "image-gallery-item";
        const imageElement = document.createElement("img");
        imageElement.src = URL.createObjectURL(image.blob);
        activeImageUrls.push(imageElement.src);
        imageElement.alt = image.caption || `${artifact.name} example ${index + 1}`;
        figure.append(imageElement);
        const caption = document.createElement("figcaption");
        caption.textContent = image.caption || `Example ${index + 1}`;
        figure.append(caption);
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-image-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete image";
        deleteButton.setAttribute("aria-label", `Delete ${image.caption || `${artifact.name} example ${index + 1}`}`);
        deleteButton.addEventListener("click", async () => {
          deleteButton.disabled = true;
          uploadStatus.textContent = "Deleting image…";
          try {
            await deleteLocalArtifactImage(image.id);
            await renderArtifactImages(artifact);
            uploadStatus.textContent = "Image deleted.";
          } catch (error) {
            deleteButton.disabled = false;
            uploadStatus.textContent = `Could not delete image: ${error.message}`;
          }
        });
        figure.append(deleteButton);
        gallery.append(figure);
      });
    }
  } catch (error) {
    emptyMessage.textContent = `Could not load local images: ${error.message}`;
    uploadStatus.textContent = `Local image storage error: ${error.message}`;
  }
}

function searchArtifacts(query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return artifacts.filter((artifact) => {
    const searchable = [
      artifact.name,
      getCategoryLabel(artifact.category),
      artifact.what,
      artifact.physics,
      artifact.keywords,
      ...artifact.spotting
    ].join(" ").toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

function renderSearchResults() {
  const query = searchInput.value;
  const hasQuery = query.trim().length > 0;
  clearSearchButton.hidden = !hasQuery;
  searchResults.hidden = !hasQuery;
  searchHint.hidden = hasQuery;

  if (!hasQuery) {
    searchResults.innerHTML = "";
    return;
  }

  const matches = searchArtifacts(query);
  if (matches.length === 0) {
    searchResults.innerHTML = `<p class="result-count">No artefacts found for “${escapeHtml(query.trim())}”. Try a different name or keyword.</p>`;
    return;
  }

  searchResults.innerHTML = `
    <p class="result-count">${matches.length} ${matches.length === 1 ? "artefact" : "artefacts"} found</p>
    ${matches.map((artifact) => `
      <button class="result-button" type="button" data-artifact-id="${artifact.id}" aria-current="${artifact.id === artifactSelect.value}">
        <span class="result-title">${artifact.name}</span>
        <span class="result-category">${getCategoryLabel(artifact.category)}</span>
      </button>
    `).join("")}
  `;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

categorySelect.addEventListener("change", () => renderArtifactOptions());
artifactSelect.addEventListener("change", () => {
  renderArtifact();
  renderSearchResults();
});
searchInput.addEventListener("input", renderSearchResults);
clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  renderSearchResults();
  searchInput.focus();
});
searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-artifact-id]");
  if (!button) {
    return;
  }

  const artifact = artifacts.find((item) => item.id === button.dataset.artifactId);
  if (!artifact) {
    return;
  }

  categorySelect.value = artifact.category;
  renderArtifactOptions(artifact.id);
  renderSearchResults();
  details.scrollIntoView({ behavior: "smooth", block: "start" });
});

atlasCount.textContent = `${artifacts.length} examples across ${categories.length} groups`;
renderCategories();
renderArtifactOptions(artifacts[0].id);
