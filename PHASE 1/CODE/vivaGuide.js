// vivaGuide.js - Academic Review 2 Viva Defense & Architecture Module
// Project: CV-Based Sales Analytics Engine | Presenter: Harish

import { academicReviewContext } from '../data/retailData.js';

export class VivaGuideModule {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeQuestionIndex = 0;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const { projectTitle, subtitle, author, reviewStage, architectureLayers, literatureSurvey, researchGapsAddressed, vivaQnA } = academicReviewContext;

    this.container.innerHTML = `
      <div class="viva-workspace">
        <!-- Academic Review Header Banner -->
        <div class="academic-banner">
          <div class="banner-badge-row">
            <span class="academic-pill review-pill">🎓 ${reviewStage}</span>
            <span class="academic-pill author-pill">👤 Presenter: <strong>${author}</strong></span>
            <span class="academic-pill stack-pill">⚡ YOLOv11 &bull; Firebase Sync &bull; Procurement Gateway</span>
          </div>
          <h2 class="academic-title">${projectTitle}</h2>
          <p class="academic-subtitle">${subtitle}</p>
        </div>

        <!-- Section 1: 4-Layer Edge-to-Cloud System Architecture -->
        <div class="review-section">
          <div class="section-header-block">
            <h3 class="section-heading">
              <span class="heading-num">01</span> 4-Layer Edge-to-Cloud Pipeline
            </h3>
            <span class="heading-caption">From raw in-store CCTV pixels to natural language manager answers</span>
          </div>

          <div class="architecture-grid">
            ${architectureLayers.map((layer, idx) => `
              <div class="arch-card" style="--card-index: ${idx}">
                <div class="arch-card-header">
                  <span class="layer-step-badge">${idx + 1}</span>
                  <h4 class="layer-name">${layer.level}</h4>
                </div>
                <div class="arch-spec-block">
                  <span class="spec-label">Tech Stack</span>
                  <span class="spec-value text-cyan">${layer.tech}</span>
                </div>
                <div class="arch-spec-block">
                  <span class="spec-label">Target Hardware</span>
                  <span class="spec-value text-amber">${layer.hardware}</span>
                </div>
                <p class="arch-function-desc">${layer.function}</p>
                <div class="arch-connector-arrow">↓</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 2: Research Gaps Addressed -->
        <div class="review-section">
          <div class="section-header-block">
            <h3 class="section-heading">
              <span class="heading-num">02</span> Research Gaps & Novel Contributions
            </h3>
            <span class="heading-caption">"Prior work solves the pieces — nobody closes the loop"</span>
          </div>

          <div class="gaps-grid">
            ${researchGapsAddressed.map(g => `
              <div class="gap-card">
                <div class="gap-header">
                  <span class="gap-icon">⚠️</span>
                  <h4 class="gap-title">${g.gap}</h4>
                </div>
                <div class="gap-prior">
                  <span class="label-tiny text-rose">PRIOR WORK LIMITATION</span>
                  <p>${g.priorWork}</p>
                </div>
                <div class="gap-solution">
                  <span class="label-tiny text-emerald">OUR PROJECT SOLUTION</span>
                  <p>${g.solutionInProject}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 3: Literature Survey Matrix -->
        <div class="review-section">
          <div class="section-header-block">
            <h3 class="section-heading">
              <span class="heading-num">03</span> Literature Survey (Grounding in Prior Work)
            </h3>
            <span class="heading-caption">Peer-reviewed publications and official Google AI architectures</span>
          </div>

          <div class="table-responsive-wrapper">
            <table class="academic-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reference & Authors</th>
                  <th>Key Summary</th>
                  <th>Direct Relation to Our Project</th>
                </tr>
              </thead>
              <tbody>
                ${literatureSurvey.map((lit, i) => `
                  <tr>
                    <td class="font-mono text-cyan">${i + 1}</td>
                    <td>
                      <strong class="paper-title">${lit.reference}</strong>
                      <div class="paper-authors">${lit.authors}</div>
                    </td>
                    <td class="paper-summary">${lit.summary}</td>
                    <td class="paper-relation font-medium text-emerald">${lit.relationToProject}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 4: Examiner Viva Defense Simulator -->
        <div class="review-section">
          <div class="section-header-block">
            <h3 class="section-heading">
              <span class="heading-num">04</span> Examiner Viva Defense Simulator
            </h3>
            <span class="heading-caption">Interactive preparation with model answers for Review 2 panel questions</span>
          </div>

          <div class="viva-simulator-card">
            <div class="viva-questions-tabs">
              ${vivaQnA.map((item, idx) => `
                <button class="viva-q-btn ${idx === this.activeQuestionIndex ? 'active' : ''}" data-idx="${idx}">
                  Q${idx + 1}: ${item.q.substring(0, 48)}...
                </button>
              `).join('')}
            </div>

            <div class="viva-answer-display" id="viva-answer-display">
              ${this.renderActiveQnAHTML()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderActiveQnAHTML() {
    const item = academicReviewContext.vivaQnA[this.activeQuestionIndex];
    if (!item) return '';

    return `
      <div class="viva-active-box">
        <div class="viva-q-header">
          <span class="viva-q-tag">EXAMINER QUESTION #${this.activeQuestionIndex + 1}</span>
          <h4 class="viva-q-text">"${item.q}"</h4>
        </div>

        <div class="viva-a-content">
          <div class="viva-a-label">
            <span class="icon-bulb">💡</span> MODEL DEFENSE ANSWER (HARISH)
          </div>
          <div class="viva-a-text">
            ${item.a}
          </div>
        </div>

        <div class="viva-tips-box">
          <span class="tip-title">📌 Review 2 Presentation Tip:</span>
          <p>Emphasize that this is not just a CV bounding-box detector, but an <strong>end-to-end autonomous decision engine</strong> that fuses vision with Point-of-Sale records and enables conversational natural-language querying.</p>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      const qBtn = e.target.closest('.viva-q-btn');
      if (qBtn) {
        const idx = parseInt(qBtn.getAttribute('data-idx'), 10);
        this.activeQuestionIndex = idx;

        // Update active class
        this.container.querySelectorAll('.viva-q-btn').forEach(b => b.classList.remove('active'));
        qBtn.classList.add('active');

        // Update answer display
        const display = document.getElementById('viva-answer-display');
        if (display) {
          display.innerHTML = this.renderActiveQnAHTML();
        }
      }
    });
  }
}
