/**
 * ContextGraph OS - Website JavaScript
 */

// Demo terminal output data
const demoOutputs = {
    regulated: [
        { type: 'output', text: '' },
        { type: 'output', text: '  ContextGraph OS - Regulated Agent Demo', highlight: true },
        { type: 'output', text: '  ─────────────────────────────────────────' },
        { type: 'output', text: '' },
        { type: 'output', text: '  [1/5] Agent proposing action...' },
        { type: 'output', text: '    Type: publish_report' },
        { type: 'output', text: '    Target: external_audience' },
        { type: 'output', text: '    Evidence: 3 claims linked' },
        { type: 'output', text: '' },
        { type: 'output', text: '  [2/5] Policy evaluation...' },
        { type: 'output', text: '    Matched: pol_external_publish_guard', warning: true },
        { type: 'output', text: '    Risk Level: HIGH', warning: true },
        { type: 'output', text: '    Result: DENY (requires approval)' },
        { type: 'output', text: '' },
        { type: 'output', text: '  [3/5] Decision queued for review' },
        { type: 'output', text: '    Queue: human_review' },
        { type: 'output', text: '    Waiting for: role:compliance_officer' },
        { type: 'output', text: '' },
        { type: 'output', text: '  [4/5] Human review completed', success: true },
        { type: 'output', text: '    Approved by: user:jane.doe', success: true },
        { type: 'output', text: '    Reason: "Report accuracy verified"', success: true },
        { type: 'output', text: '' },
        { type: 'output', text: '  [5/5] Action executed', success: true },
        { type: 'output', text: '    Status: COMPLETED' },
        { type: 'output', text: '    Decision ID: dec_7x9k2m4n' },
        { type: 'output', text: '    Provenance: prov_8y3j5p2q' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Full audit trail recorded', success: true },
    ],
    temporal: [
        { type: 'output', text: '' },
        { type: 'output', text: '  ContextGraph OS - Temporal Query Demo', highlight: true },
        { type: 'output', text: '  ─────────────────────────────────────────' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Creating temporal data history...' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Timeline:' },
        { type: 'output', text: '  ├─ Mar 1:  status = "draft"' },
        { type: 'output', text: '  ├─ Mar 10: status = "reviewed"' },
        { type: 'output', text: '  └─ Mar 20: status = "published"' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Query: "What was the status on March 15?"', highlight: true },
        { type: 'output', text: '' },
        { type: 'output', text: '  await ckg.query({' },
        { type: 'output', text: '    entityId: reportId,' },
        { type: 'output', text: '    asOf: "2024-03-15T00:00:00Z"' },
        { type: 'output', text: '  });' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Result:', success: true },
        { type: 'output', text: '  {' },
        { type: 'output', text: '    attribute: "status",' },
        { type: 'output', text: '    value: "reviewed",', success: true },
        { type: 'output', text: '    validFrom: "2024-03-10T00:00:00Z",' },
        { type: 'output', text: '    validUntil: "2024-03-20T00:00:00Z",' },
        { type: 'output', text: '    source: { type: "analyst", id: "user_123" }' },
        { type: 'output', text: '  }' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Time-travel query successful!', success: true },
    ],
    audit: [
        { type: 'output', text: '' },
        { type: 'output', text: '  ContextGraph OS - Audit Report Demo', highlight: true },
        { type: 'output', text: '  ─────────────────────────────────────────' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Generating Q4 2024 compliance report...' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Aggregating decisions... 1,250 found' },
        { type: 'output', text: '  Linking evidence... 3,847 claims' },
        { type: 'output', text: '  Verifying provenance... 100% valid', success: true },
        { type: 'output', text: '' },
        { type: 'output', text: '  Report Summary:', highlight: true },
        { type: 'output', text: '  ┌─────────────────────────────────────┐' },
        { type: 'output', text: '  │ Total Decisions:      1,250        │' },
        { type: 'output', text: '  │ Approved:             1,100 (88%)  │', success: true },
        { type: 'output', text: '  │ Rejected:               120 (10%)  │', warning: true },
        { type: 'output', text: '  │ Failed:                  30 (2%)   │' },
        { type: 'output', text: '  │ Human Reviews:          188 (15%)  │' },
        { type: 'output', text: '  │ Avg Processing Time:    2.5 hours  │' },
        { type: 'output', text: '  └─────────────────────────────────────┘' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Exporting to:' },
        { type: 'output', text: '  ├─ q4-2024-decisions.json (2.4 MB)' },
        { type: 'output', text: '  ├─ q4-2024-decisions.pdf (156 KB)' },
        { type: 'output', text: '  └─ q4-2024-summary.csv (45 KB)' },
        { type: 'output', text: '' },
        { type: 'output', text: '  Audit report generated successfully!', success: true },
    ]
};

// Demo tabs functionality
document.querySelectorAll('.demo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active panel
        const demoId = tab.dataset.demo;
        document.querySelectorAll('.demo-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`demo-${demoId}`).classList.add('active');
    });
});

// Run demo function
async function runDemo(type) {
    const terminal = document.getElementById(`terminal-${type}`);
    const runBtn = terminal.parentElement.querySelector('.demo-run-btn');

    // Disable button during demo
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner"></span> Running...';

    // Clear previous output except command line
    const lines = terminal.querySelectorAll('.terminal-line');
    lines.forEach((line, i) => {
        if (i > 0) line.remove();
    });

    // Animate output
    const output = demoOutputs[type];
    for (let i = 0; i < output.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 80));

        const line = document.createElement('div');
        line.className = 'terminal-line';

        const span = document.createElement('span');
        span.className = 'output';
        if (output[i].success) span.classList.add('success');
        if (output[i].warning) span.classList.add('warning');
        if (output[i].highlight) span.classList.add('highlight');
        span.textContent = output[i].text;

        line.appendChild(span);
        terminal.appendChild(line);

        // Scroll to bottom
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Re-enable button
    runBtn.disabled = false;
    runBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Run Again
    `;
}

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const item = question.parentElement;
        const isActive = item.classList.contains('active');

        // Close all other items
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

        // Toggle current item
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// Mobile navigation toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add scroll-based nav background
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.problem-card, .feature-card, .audience-card, .pricing-card').forEach(el => {
    observer.observe(el);
});

// Add CSS for animations and mobile nav
const style = document.createElement('style');
style.textContent = `
    .nav-links.active {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(10, 10, 11, 0.98);
        padding: var(--space-lg);
        border-bottom: 1px solid var(--color-border);
    }

    .nav-toggle.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }

    .nav-toggle.active span:nth-child(2) {
        opacity: 0;
    }

    .nav-toggle.active span:nth-child(3) {
        transform: rotate(-45deg) translate(5px, -5px);
    }

    .nav.scrolled {
        background: rgba(10, 10, 11, 0.95);
    }

    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .problem-card,
    .feature-card,
    .audience-card,
    .pricing-card {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.5s ease, transform 0.5s ease;
    }

    .problem-card.visible,
    .feature-card.visible,
    .audience-card.visible,
    .pricing-card.visible {
        opacity: 1;
        transform: translateY(0);
    }

    .terminal-body {
        overflow-y: auto;
    }
`;
document.head.appendChild(style);

// Make runDemo globally available
window.runDemo = runDemo;
