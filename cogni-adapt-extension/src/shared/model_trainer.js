/**
 * Model Trainer - Manages training data and fine-tuning
 * Collects real-time user behavior and periodically trains the model
 */

const modelTrainer = {
  trainingData: [],
  maxDataPoints: 1000, // Store up to 1000 data points
  lastTrainTime: null,
  trainInterval: 24 * 60 * 60 * 1000, // Train daily
  
  // Add a training example
  addTrainingExample(prompt, recommendations, feedback) {
    const example = {
      timestamp: new Date().toISOString(),
      prompt,
      recommendations,
      feedback, // User feedback on recommendation quality
      userBehavior: { /* captured interaction data */ }
    };
    
    this.trainingData.push(example);
    
    // Keep data size manageable
    if (this.trainingData.length > this.maxDataPoints) {
      this.trainingData.shift();
    }
    
    // Auto-save to IndexedDB
    this.saveToIndexedDB();
  },
  
  // Save training data to IndexedDB for persistence
  async saveToIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("CogniAdapt", 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["trainingData"], "readwrite");
        const store = transaction.objectStore("trainingData");
        
        store.clear();
        store.add({
          id: 1,
          data: this.trainingData,
          savedAt: new Date().toISOString()
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("trainingData")) {
          db.createObjectStore("trainingData", { keyPath: "id" });
        }
      };
    });
  },
  
  // Load training data from IndexedDB
  async loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("CogniAdapt", 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["trainingData"], "readonly");
        const store = transaction.objectStore("trainingData");
        const getRequest = store.get(1);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            this.trainingData = getRequest.result.data || [];
          }
          resolve();
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Check if training is needed
  shouldTrain() {
    if (!this.lastTrainTime) return this.trainingData.length > 50;
    return Date.now() - this.lastTrainTime > this.trainInterval;
  },
  
  // Prepare training data for model
  formatTrainingData() {
    return this.trainingData.map(example => ({
      text: example.prompt,
      labels: this.encodeRecommendations(example.recommendations)
    }));
  },
  
  // Encode recommendations as training labels
  encodeRecommendations(recs) {
    return {
      focus_mode: recs.focus_mode ? 1 : 0,
      reduce_distractions: recs.reduce_distractions ? 1 : 0,
      reading_ease: recs.reading_ease ? 1 : 0,
      step_by_step: recs.step_by_step ? 1 : 0,
      time_control: recs.time_control ? 1 : 0,
      intensity: {
        mild: recs.focus_level === "mild" ? 1 : 0,
        med: recs.focus_level === "med" ? 1 : 0,
        strong: recs.focus_level === "strong" ? 1 : 0
      }
    };
  },
  
  // Get training statistics
  getStats() {
    const focuses = this.trainingData.filter(d => d.recommendations.focus_mode).length;
    const reading = this.trainingData.filter(d => d.recommendations.reading_ease).length;
    const stepStep = this.trainingData.filter(d => d.recommendations.step_by_step).length;
    
    return {
      totalExamples: this.trainingData.length,
      focus_mode: focuses,
      reading_ease: reading,
      step_by_step: stepStep,
      lastTrained: this.lastTrainTime,
      shouldTrainNow: this.shouldTrain()
    };
  },
  
  // Clear old data
  clearOldData(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    this.trainingData = this.trainingData.filter(example => {
      return new Date(example.timestamp).getTime() > cutoffTime;
    });
    this.saveToIndexedDB();
  }
};

// Initialize on load
modelTrainer.loadFromIndexedDB().catch(e => {
  console.warn("[ModelTrainer] Failed to load training data:", e.message);
});

// Expose globally
window.__modelTrainer = modelTrainer;
