# CalliGen-Generating-Chinese-Characters-with-Hand-written-Skeleton-and-Font-Stroke-Style
![Qualitative Results](assets/qualitative.png)
## Generation
### Requirements
```bash
# Install dependencies
pip install -r requirements_full.txt
```
### Data preparation
#### 1. Prepare your TrueType font file.
#### 2. Specify the path of your TrueType font file, the directory of the rendered character images, and the skeleton images in "generation_better_data.py".
#### 3. Run the following command
```bash
python generate_better_data.py
```
### Training
```bash
python /hpc2hdd/home/mli861/cmaaproject/train_eval.py --real_dir your_directory_of_rendered_character_images --sk_dir your_directory_of_the_skeleton_images  --out_dir your_output_dir --img_size 512 --batch 8 --max_steps 100000 --sample_freq 1000 --ckpt_freq 1000 --amp
```
### Inferencing
```bash
python inference_pix2pix.py --ckpt the_checkpoint_you-selected_from_your-output_dir --input path_to_your_input_image --out path_to_save_the_output_image
```

## Frontend

The React + TypeScript interface is in [`web/frontend`](web/frontend). To run it locally:

```bash
cd web/frontend
npm ci
npm run dev
```

Open `/calligen` at the address printed by Vite. The interface runs independently; AI generation requires a separately configured backend. See the [frontend README](web/frontend/README.md) for build and preview commands.
