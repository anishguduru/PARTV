/**
 * services/priorityQueue.ts
 * 
 * A Min-Priority Queue implementation.
 * 
 * WHY IS THIS NEEDED?
 * Dijkstra and A* algorithms need to always explore the "most promising" node next.
 * The "most promising" is the one with the lowest current distance (or estimated distance).
 * A Priority Queue allows us to insert items and always retrieve the smallest one efficiently.
 */
export class PriorityQueue<T> {
  // We store elements as a simple array for simplicity.
  // In a production environment with millions of nodes, a Binary Heap would be preferred
  // for O(log n) insertions. Current implementation is O(n) insertion.
  private items: { element: T; priority: number }[];

  constructor() {
    this.items = [];
  }

  /**
   * Adds an element to the queue in the correct sorted position.
   * Time Complexity: O(N) due to splicing.
   * @param element The value to store (e.g., Node ID)
   * @param priority The cost/distance (Lower value = Higher Priority)
   */
  enqueue(element: T, priority: number) {
    const queueElement = { element, priority };
    let added = false;
    
    // Linear scan to find insertion point to keep array sorted
    for (let i = 0; i < this.items.length; i++) {
      if (queueElement.priority < this.items[i].priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }
    
    // If it's the largest value, push to end
    if (!added) {
      this.items.push(queueElement);
    }
  }

  /**
   * Removes and returns the element with the lowest priority value.
   * Time Complexity: O(1)
   */
  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}