export default class DataLoop {

    #dataLoop;
    #dataLoopLength;
    #nextDataIndex = 0;

    constructor(length) {

        this.#dataLoop = new Array(length);
        this.#dataLoopLength = length;
    }

    push(data) {

        this.#dataLoop[this.#nextDataIndex] = data;

        this.#nextDataIndex++;

        if (this.#nextDataIndex >= this.#dataLoopLength)
            this.#nextDataIndex = 0;
    }

    exists(data) {

        let checkIndex;

        for (let i = 0; i < this.#dataLoopLength; i++) {

            checkIndex = this.#nextDataIndex - 1 - i;

            if (checkIndex < 0)
                checkIndex = this.#dataLoopLength - 1 - i;

            if (this.#dataLoop[checkIndex] === data)
                return true;
        }

        return false;
    }
}